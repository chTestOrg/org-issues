// projectV2/services/syncPRBody.mjs
import { stripAutoInfoBlocks, buildInfoBlock, extractAutoBlockContent } from "../helpers/buildInformBlock.mjs";
import { parseIssuesFromBody } from "../helpers/parseLinkedIssues.mjs";

const LINKED_BLOCK = {
    start: "<!-- AUTO-GENERATED:LINKED-ISSUES:START -->",
    end: "<!-- AUTO-GENERATED:LINKED-ISSUES:END -->",
};

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

    const blockText = extractAutoBlockContent(originalBody, LINKED_BLOCK);
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

export async function syncPRBody({ github, context, core, quietOctokit }, rawIssues, pr) {
    const { owner, repo } = context.repo;
    const originalBody = pr.body ?? "";

    core.info("=== SYNC PR BODY START ===");

    const { previousExplicit, previousLinked } = extractPreviousState(originalBody);
    const cleanBody = stripAutoInfoBlocks(originalBody, LINKED_BLOCK,);

    // Визначаємо, що користувач написав вручну
    const bodyParsed = parseIssuesFromBody(cleanBody);
    const bodyKeys = new Set(bodyParsed.map(i => `${i.owner || owner}/${i.repo || repo}#${i.number}`));

    const finalIssuesMap = new Map();

    // ОДИН ПРОХІД ПО ЗАДАЧАХ
    for (const issue of rawIssues) {
        const key = buildKey(issue);
        const short = `#${issue.number}`;

        const isFromCommit = issue.sources?.has("commit");
        const isFromBody = bodyKeys.has(key);
        const isFromGraphQL = issue.sources?.has("graphql");

        // Пріоритет 1: Явне згадування (Explicit)
        if (isFromCommit || isFromBody) {
            finalIssuesMap.set(key, { ...issue, displaySource: "explicit" });
            continue;
        }

        // Пріоритет 2: Зв'язок через UI (Linked)
        // Додаємо, якщо: задача прийшла з GraphQL і (вона вже була Linked АБО вона нова і не була Explicit)
        const wasPreviouslyLinked = previousLinked.has(short);
        const wasNotPreviouslyExplicit = !previousExplicit.has(short);

        if (isFromGraphQL && (wasPreviouslyLinked || wasNotPreviouslyExplicit)) {
            if (!finalIssuesMap.has(key)) {
                finalIssuesMap.set(key, { ...issue, displaySource: "ui" });
            }
        }
    }

    const finalIssues = Array.from(finalIssuesMap.values());

    // Формування контенту
    const content = finalIssues.length > 0
        ? formatIssuesContent(finalIssues)
        : "Pull Request не містить посилань на пов’язані задачі.\nДля проходження автоматизації необхідно додати reference на GitHub Issue у форматі URL.";

    const infoBlock = buildInfoBlock({
        type: finalIssues.length > 0 ? "note" : "caution",
        content,
        markers: LINKED_BLOCK,
    });

    const updatedBody = `${cleanBody}\n\n${infoBlock}`.trim();

    if (updatedBody !== originalBody.trim()) {
        await quietOctokit.rest.pulls.update({ owner, repo, pull_number: pr.number, body: updatedBody });
        core.notice("PR body updated.");
    } else {
        core.notice("PR body already up to date.");
    }

    core.info("=== SYNC PR BODY END ===");
}