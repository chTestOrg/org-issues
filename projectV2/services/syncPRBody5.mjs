// projectV2/services/syncPRBody.mjs
import { stripAutoInfoBlocks, buildInfoBlock, AUTO_BLOCK } from "../helpers/buildInformBlock.mjs";
import { parseIssuesFromBody } from "../helpers/parseLinkedIssues.mjs";

function buildKey(issue) {
    return `${issue.owner}/${issue.repo}#${issue.number}`;
}

/**
 * Витягує snapshot попереднього стану з останнього авто-блоку
 *
 * ПРИЙМАЄ: originalBody (повний текст PR)
 * ПОВЕРТАЄ: { previousExplicit, previousLinked }
 *
 * Це наш "історичний" стан, який використовуємо для розуміння,
 * що було в блоці на попередньому проході.
 */
function extractPreviousState(originalBody = "") {
    const previousExplicit = new Set();
    const previousLinked = new Set();

    if (!originalBody) return { previousExplicit, previousLinked };

    const { start, end } = AUTO_BLOCK;

    const blockStart = originalBody.lastIndexOf(start);
    if (blockStart === -1) return { previousExplicit, previousLinked };

    const blockEnd = originalBody.indexOf(end, blockStart);
    if (blockEnd === -1) return { previousExplicit, previousLinked };

    const blockText = originalBody.slice(blockStart, blockEnd);

    const lines = blockText
        .split("\n")
        .map(l => l.replace(/^>\s*/, "").trim())
        .filter(Boolean);

    for (const line of lines) {
        const match = line.match(/^(Closes|Linked):.*?#(\d+)/);
        if (!match) continue;

        const [, type, number] = match;
        const short = `#${number}`;

        if (type === "Closes") previousExplicit.add(short);
        if (type === "Linked") previousLinked.add(short);
    }

    return { previousExplicit, previousLinked };
}

/**
 * Формує текст інфоблоку (не змінюємо логіку)
 */
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
 * ГОЛОВНА ФУНКЦІЯ — syncPRBody
 *
 * ПРИЙМАЄ:
 *   - rawIssues — масив задач з полем sources: Set<'commit' | 'body' | 'graphql'>
 *   - pr — об'єкт pull request
 *
 * МЕТА:
 *   - На першому проході: сформувати коректний блок (Closes + Linked)
 *   - На наступних проходах: зрозуміти дельту змін і оновити блок тільки якщо треба
 */
export async function syncPRBody({ github, context, core }, rawIssues, pr) {
    const { owner, repo } = context.repo;
    const originalBody = pr.body ?? "";

    core.info("=== SYNC PR BODY START ===");

    // ────────────────────────────────────────────────
    // 1. Отримуємо snapshot попереднього блоку
    //    (Closes і Linked з минулого проходу)
    // ────────────────────────────────────────────────
    const { previousExplicit, previousLinked } = extractPreviousState(originalBody);

    // ────────────────────────────────────────────────
    // 2. Чисте тіло — без нашого авто-блоку
    // ────────────────────────────────────────────────
    const cleanBody = stripAutoInfoBlocks(originalBody);

    // ────────────────────────────────────────────────
    // 3. Що користувач реально написав у тілі (без блоку бота)
    // ────────────────────────────────────────────────
    const bodyParsed = parseIssuesFromBody(cleanBody);
    const bodyKeys = new Set(
        bodyParsed.map(i => {
            const o = i.owner || owner;
            const r = i.repo || repo;
            return `${o}/${r}#${i.number}`;
        })
    );

    // ────────────────────────────────────────────────
    // 4. Задачі, які прийшли з комітів
    // ────────────────────────────────────────────────
    const commitKeys = new Set(
        rawIssues
            .filter(i => i.sources?.has("commit"))
            .map(buildKey)
    );

    // ────────────────────────────────────────────────
    // 5. Формуємо CURRENT EXPLICIT (Closes)
    //    ТІЛЬКИ те, що є зараз у комітах або в чистому тілі користувача
    // ────────────────────────────────────────────────
    const explicitNowMap = new Map();

    rawIssues.forEach(issue => {
        const key = buildKey(issue);

        if (bodyKeys.has(key) || commitKeys.has(key)) {
            explicitNowMap.set(key, {
                ...issue,
                displaySource: "explicit"
            });
        }
    });

    const explicitNowKeys = new Set(explicitNowMap.keys());

    // ────────────────────────────────────────────────
    // 6. Обробка Linked (UI-задачі)
    //    6.1 — зберігаємо старі Linked, які ще є в GraphQL
    //    6.2 — додаємо нові Linked, яких раніше не було в explicit
    // ────────────────────────────────────────────────
    const graphQlIssues = rawIssues.filter(i => i.sources?.has("graphql"));

    // Старі Linked, які ще живі
    const preservedLinked = graphQlIssues.filter(issue =>
        previousLinked.has(`#${issue.number}`)
    );

    // Нові Linked (не були explicit раніше і не є explicit зараз)
    const newUiLinked = graphQlIssues.filter(issue => {
        const short = `#${issue.number}`;
        const key = buildKey(issue);

        return (
            !previousExplicit.has(short) &&
            !explicitNowKeys.has(key)
        );
    });

    const uiNowMap = new Map();

    [...preservedLinked, ...newUiLinked].forEach(issue => {
        const key = buildKey(issue);
        if (!explicitNowMap.has(key)) {
            uiNowMap.set(key, { ...issue, displaySource: "ui" });
        }
    });

    // ────────────────────────────────────────────────
    // 7. Фінальний список задач для блоку
    // ────────────────────────────────────────────────
    const finalMap = new Map();
    explicitNowMap.forEach((v, k) => finalMap.set(k, v));
    uiNowMap.forEach((v, k) => {
        if (!finalMap.has(k)) finalMap.set(k, v);
    });

    const finalIssues = Array.from(finalMap.values());

    // ────────────────────────────────────────────────
    // 8. Генерація нового інфоблоку
    // ────────────────────────────────────────────────
    let infoBlock;
    if (finalIssues.length === 0) {
        infoBlock = buildInfoBlock({
            type: "caution",
            content:
                "Pull Request не містить посилань на пов’язані задачі.\n" +
                "Для проходження автоматизації необхідно додати reference на GitHub Issue у форматі URL."
        });
    } else {
        infoBlock = buildInfoBlock({
            type: "note",
            content: formatIssuesContent(finalIssues)
        });
    }

    const updatedBody = `${cleanBody}\n\n${infoBlock}`.trim();

    // ────────────────────────────────────────────────
    // 9. Оновлюємо PR тільки якщо блок реально змінився
    // ────────────────────────────────────────────────
    if (updatedBody !== originalBody.trim()) {
        await github.rest.pulls.update({
            owner,
            repo,
            pull_number: pr.number,
            body: updatedBody
        });

        core.notice("PR body updated (snapshot-based sync).");
    } else {
        core.notice("PR body already up to date.");
    }

    core.info("=== SYNC PR BODY END ===");
}