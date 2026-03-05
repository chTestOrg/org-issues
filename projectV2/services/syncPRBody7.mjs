// projectV2/services/syncPRBody.mjs
import { stripAutoInfoBlocks, buildInfoBlock, extractAutoBlockContent } from "../helpers/buildInformBlock.mjs";
import { parseIssuesFromBody } from "../helpers/parseLinkedIssues.mjs";

/**
 * Створює людиночитаний ключ для порівняння задач
 */
function buildKey(issue) {
    return `${issue.owner}/${issue.repo}#${issue.number}`;
}

/**
 * Парсить попередній стан блоку бота
 */
function extractPreviousState(originalBody = "") {
    const previousExplicit = new Set();
    const previousLinked = new Set();

    const blockText = extractAutoBlockContent(originalBody);
    if (!blockText) return { previousExplicit, previousLinked };

    // Шукаємо патерни: Closes: [назва #123](url) або Linked: [назва #123](url)
    // Регулярка витягує префікс та номер
    const lines = blockText.split("\n");
    for (const line of lines) {
        const match = line.match(/(Closes|Linked):\s+.*#(\d+)/i);
        if (!match) continue;

        const [ , type, number] = match;
        const short = `#${number}`;

        if (type.toLowerCase() === "closes") previousExplicit.add(short);
        else previousLinked.add(short);
    }

    return { previousExplicit, previousLinked };
}

function formatIssuesContent(issues) {
    const repoMap = new Map();
    for (const issue of issues) {
        const key = `${issue.owner}/${issue.repo}`;
        if (!repoMap.has(key)) repoMap.set(key, []);
        repoMap.get(key).push(issue);
    }

    const lines = ["### Linked Issues:"];
    const repoEntries = Array.from(repoMap.entries());

    for (const [repoKey, repoIssues] of repoEntries) {
        if (repoEntries.length > 1) {
            lines.push("", `**Repository: ${repoKey}**`);
        }
        for (const issue of repoIssues) {
            const prefix = issue.displaySource === "explicit" ? "Closes:" : "Linked:";
            lines.push(`${prefix} [${issue.title} #${issue.number}](${issue.url})`);
        }
    }
    return lines.join("\n");
}

export async function syncPRBody({ github, context, core }, rawIssues, pr) {
    const { owner, repo } = context.repo;
    const originalBody = pr.body ?? "";

    core.info("=== SYNC PR BODY START ===");

    // 1. Отримуємо стан попереднього блоку (що бот додав минулого разу)
    const { previousExplicit, previousLinked } = extractPreviousState(originalBody);
    const cleanBody = stripAutoInfoBlocks(originalBody);

    // 2. Визначаємо, що саме написав користувач (без блоку бота)
    // Це єдиний додатковий парсинг, який нам потрібен, щоб відділити "текст юзера"
    const userIssuesInBody = new Set(
        parseIssuesFromBody(cleanBody).map(i => `${i.owner || owner}/${i.repo || repo}#${i.number}`)
    );

    const finalIssuesMap = new Map();

    // 3. ОДИН ПРОХІД ПО ГОТОВИХ ДАНИХ
    for (const issue of rawIssues) {
        const key = buildKey(issue);
        const short = `#${issue.number}`;

        // Умова для EXPLICIT (Closes):
        // Задача з коміту АБО задача, яку користувач вписав у чисте тіло PR
        const isExplicit = issue.sources.has("commit") || userIssuesInBody.has(key);

        if (isExplicit) {
            finalIssuesMap.set(key, { ...issue, displaySource: "explicit" });
            continue;
        }

        // Умова для LINKED (Linked):
        // Це те, що прийшло з GraphQL, АЛЕ не було "Closes" раніше
        if (issue.sources.has("graphql")) {
            const wasLinkedBefore = previousLinked.has(short);
            const wasNotExplicitBefore = !previousExplicit.has(short);

            if (wasLinkedBefore || wasNotExplicitBefore) {
                finalIssuesMap.set(key, { ...issue, displaySource: "ui" });
            }
        }
    }

    // 4. ГЕНЕРАЦІЯ ТА ОНОВЛЕННЯ
    const finalIssues = Array.from(finalIssuesMap.values());
    const isSuccess = finalIssues.length > 0;

    const infoBlock = buildInfoBlock({
        type: isSuccess ? "note" : "caution",
        content: isSuccess
            ? formatIssuesContent(finalIssues)
            : "Pull Request не містить посилань на пов’язані задачі.\nДля проходження автоматизації необхідно додати reference на GitHub Issue."
    });

    const updatedBody = `${cleanBody}\n\n${infoBlock}`.trim();

    if (updatedBody !== originalBody.trim()) {
        await github.rest.pulls.update({ owner, repo, pull_number: pr.number, body: updatedBody });
        core.notice("PR body updated using unified sources.");
    } else {
        core.notice("PR body already up to date.");
    }

    core.info("=== SYNC PR BODY END ===");
}
