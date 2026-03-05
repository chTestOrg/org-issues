// projectV2/services/syncPRBody.mjs
import {stripAutoInfoBlocks, buildInfoBlock, AUTO_BLOCK} from "../helpers/buildInformBlock.mjs";
import { parseIssuesFromBody } from "../helpers/parseLinkedIssues.mjs";

function buildKey(issue) {
    return `${issue.owner}/${issue.repo}#${issue.number}`;
}

/**
 * Витягує попередній snapshot з останнього AUTO-блоку
 * Це наш "дельта" — минулий стан (Closes + Linked)
 */
function extractPreviousState(originalBody = "") {
    const previousExplicit = new Set(); // Closes з минулого блоку

    if (!originalBody) return { previousExplicit };

    const {start, end} = AUTO_BLOCK;

    const blockStart = originalBody.lastIndexOf(start);
    if (blockStart === -1) return { previousExplicit };

    const blockEnd = originalBody.indexOf(end, blockStart) + end.length;
    const blockText = originalBody.slice(blockStart, blockEnd);

    const lines = blockText
        .split("\n")
        .map(l => l.replace(/^>\s*/, "").trim())
        .filter(Boolean);

    for (const line of lines) {
        const match = line.match(/^(Closes|Linked):\s*(?:\[.*?#)?(\d+)/);
        if (!match) continue;

        const [, type, number] = match;
        if (type === "Closes") previousExplicit.add(`#${number}`);
    }
    console.log("previousExplicit", previousExplicit);

    return { previousExplicit };
}

function formatIssuesContent(issues) {
    const repoMap = new Map();
    for (const issue of issues) {
        const key = `${issue.owner}/${issue.repo}`;
        if (!repoMap.has(key)) repoMap.set(key, []);
        repoMap.get(key).push(issue);
    }

    const repoGroups = Array.from(repoMap.entries());
    const lines = ["### Linked Issues:"];

    for (const [repoKey, repoIssues] of repoGroups) {
        if (repoGroups.length > 1) {
            lines.push("");
            lines.push(`**Repository: ${repoKey}**`);
        }
        for (const issue of repoIssues) {
            const prefix = issue.displaySource === "explicit" ? "Closes:" : "Linked:";
            lines.push(`${prefix} [${issue.title} #${issue.number}](${issue.url})`);
        }
    }
    return lines.join("\n");
}

/**
 * Основна функція синхронізації інфоблоку
 *
 * ПРИЙМАЄ:
 *   - rawIssues — масив задач з джерелами (sources: Set<'commit' | 'body' | 'graphql'>)
 *   - pr — об'єкт pull request (потрібен для body та номера)
 *
 * РОБИТЬ:
 *   1. Витягує попередній стан (Closes) з авто-блоку
 *   2. Очищає body від старого блоку
 *   3. Визначає, що є "explicit" (коміти + чисте body користувача)
 *   4. Додає Linked тільки для справжніх UI-референсів
 *   5. Порівнює новий блок зі старим → оновлює тільки при змінах
 *
 * ПОВЕРТАЄ: нічого (оновлює PR через GitHub API)
 */
export async function syncPRBody({ github, context, core }, rawIssues, pr) {
    const { owner, repo } = context.repo;
    const originalBody = pr.body ?? "";

    core.info("=== SYNC PR BODY START ===");
    core.info(`PR #${pr.number} | Original length: ${originalBody.length}`);

    // ─────────────────────────────────────────────────────────────
    // 1. Snapshot попереднього блоку (дельта!)
    //    Це ключовий момент для стабільності на 2-му+ проході
    // ─────────────────────────────────────────────────────────────
    const { previousExplicit } = extractPreviousState(originalBody);
    core.info(`Previous Explicit (Closes): ${Array.from(previousExplicit).join(", ") || "(none)"}`);

    // ─────────────────────────────────────────────────────────────
    // 2. Чисте тіло користувача (без нашого авто-блоку)
    // ─────────────────────────────────────────────────────────────
    const cleanBody = stripAutoInfoBlocks(originalBody);

    // ─────────────────────────────────────────────────────────────
    // 3. Явні задачі, які написав користувач у чистому тілі
    // ─────────────────────────────────────────────────────────────
    const userBodyParsed = parseIssuesFromBody(cleanBody);
    const userBodyKeys = new Set(
        userBodyParsed.map(i => {
            const o = i.owner || owner;
            const r = i.repo || repo;
            return `${o}/${r}#${i.number}`;
        })
    );

    console.log("userBodyKeys",userBodyKeys)

    // ─────────────────────────────────────────────────────────────
    // 4. Визначаємо ключі з комітів (навіть якщо source перезаписався)
    // ─────────────────────────────────────────────────────────────
    const commitKeys = new Set(
        rawIssues
            .filter(i => i.sources?.has("commit"))
            .map(buildKey)
    );

    core.info(`Commit keys: ${Array.from(commitKeys).join(", ") || "(none)"}`);

    // ─────────────────────────────────────────────────────────────
    // 5. Формуємо Explicit (Closes)
    //    = коміти + чисте body користувача + те, що було Closes у попередньому блоці
    // ─────────────────────────────────────────────────────────────
    const explicitNowMap = new Map();

    rawIssues.forEach(issue => {
        const key = buildKey(issue);
        const short = `#${issue.number}`;

        const isExplicit =
            issue.sources?.has("commit") ||                              // з комітів
            (issue.sources?.has("body") && userBodyKeys.has(key)) ||    // користувач написав
            commitKeys.has(key) ||                                      // захист комітів
            previousExplicit.has(key) ||
            previousExplicit.has(short);

        if (isExplicit) {
            explicitNowMap.set(key, { ...issue, displaySource: "explicit" });
        }
    });

    const explicitNowKeys = new Set(explicitNowMap.keys());
    core.info(`Explicit NOW: ${Array.from(explicitNowKeys).join(", ") || "(none)"}`);

    // ─────────────────────────────────────────────────────────────
    // 6. Linked (UI) = graphql, яких немає в explicit
    // ─────────────────────────────────────────────────────────────
    const uiNowMap = new Map();
    rawIssues
        .filter(i => i.sources?.has("graphql"))
        .forEach(issue => {
            const key = buildKey(issue);
            if (!explicitNowKeys.has(key)) {
                uiNowMap.set(key, { ...issue, displaySource: "ui" });
            }
        });

    core.info(`Linked (UI): ${Array.from(uiNowMap.keys()).join(", ") || "(none)"}`);

    // ─────────────────────────────────────────────────────────────
    // 7. Фінальний список задач
    // ─────────────────────────────────────────────────────────────
    const finalMap = new Map();
    explicitNowMap.forEach((v, k) => finalMap.set(k, v));
    uiNowMap.forEach((v, k) => {
        if (!finalMap.has(k)) finalMap.set(k, v);
    });

    const finalIssues = Array.from(finalMap.values());
    console.log("finalMap",finalMap)


    // ─────────────────────────────────────────────────────────────
    // 8. Формуємо новий інфоблок
    // ─────────────────────────────────────────────────────────────
    let infoBlock;
    if (finalIssues.length === 0) {
        infoBlock = buildInfoBlock({
            type: "caution",
            content: "Pull Request не містить посилань на пов’язані задачі.\nДля проходження автоматизації необхідно додати reference на GitHub Issue у форматі URL."
        });
    } else {
        infoBlock = buildInfoBlock({
            type: "note",
            content: formatIssuesContent(finalIssues)
        });
    }

    const updatedBody = `${cleanBody}\n\n${infoBlock}`.trim();

    // ─────────────────────────────────────────────────────────────
    // 9. Оновлюємо PR ТІЛЬКИ якщо є реальна зміна (дельта)
    // ─────────────────────────────────────────────────────────────
    if (updatedBody !== originalBody.trim()) {
        await github.rest.pulls.update({
            owner,
            repo,
            pull_number: pr.number,
            body: updatedBody
        });
        core.notice("PR body updated with delta-based issue sync.");
    } else {
        core.notice("PR body is already up to date. No delta detected.");
    }

    core.info("=== SYNC PR BODY END ===");
}