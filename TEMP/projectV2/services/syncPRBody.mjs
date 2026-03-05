// syncPRBody.mjs
import { stripAutoInfoBlocks } from "../helpers/buildInformBlock.mjs";
import { parseIssuesFromBody } from "../helpers/parseLinkedIssues.mjs";
import { buildInfoBlock } from "../helpers/buildInformBlock.mjs";

/**
 * Локальна функція.
 * Відновлює попередній snapshot зі старого інфоблоку.
 * Повертає:
 * {
 *   previousExplicit: Set<string>,
 *   previousLinked: Set<string>
 * }
 */
function extractPreviousStateFromBlock(originalBody = "") {
    const previousExplicit = new Set();
    const previousLinked = new Set();

    const regex =
        /(Closes|Linked): .*?\((https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/issues\/(\d+))\)/g;

    let match;

    while ((match = regex.exec(originalBody)) !== null) {
        const [, type, , owner, repo, number] = match;

        const key = `${owner}/${repo}#${number}`;

        if (type === "Closes") {
            previousExplicit.add(key);
        } else {
            previousLinked.add(key);
        }
    }

    return { previousExplicit, previousLinked };
}

function buildKey(issue) {
    return `${issue.owner}/${issue.repo}#${issue.number}`;
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
            const prefix =
                issue.displaySource === "explicit"
                    ? "Closes:"
                    : "Linked:";

            lines.push(
                `${prefix} [${issue.title} #${issue.number}](${issue.url})`
            );
        }
    }
    return lines.join("\n");
}


export async function syncPRBody({ github, context, core }, rawIssues, pr) {
    const { owner, repo } = context.repo;
    const originalBody = pr.body ?? "";

    // -------------------------------------------------
    // 1️⃣ Відновлюємо попередній snapshot
    // -------------------------------------------------
    const { previousExplicit } =
        extractPreviousStateFromBlock(originalBody);

    // -------------------------------------------------
    // 2️⃣ Очищаємо боді від старого блоку
    // -------------------------------------------------
    const cleanBody = stripAutoInfoBlocks(originalBody);

    // -------------------------------------------------
    // 3️⃣ Explicit NOW (commit + clean body)
    // -------------------------------------------------
    const explicitNowMap = new Map();

    rawIssues.forEach((issue) => {
        if (issue.source === "commit" || issue.source === "body") {
            const key = buildKey(issue);
            explicitNowMap.set(key, issue);
        }
    });

    const explicitNowKeys = new Set(explicitNowMap.keys());

    // -------------------------------------------------
    // 4️⃣ GraphQL NOW
    // -------------------------------------------------
    const graphqlMap = new Map();

    rawIssues
        .filter((i) => i.source === "graphql")
        .forEach((issue) => {
            const key = buildKey(issue);
            graphqlMap.set(key, issue);
        });

    // -------------------------------------------------
    // 5️⃣ Обчислюємо UI задачі
    //
    // uiNow = graphql
    //         - explicitNow
    //         - previousExplicit
    // -------------------------------------------------
    const uiNowMap = new Map();

    graphqlMap.forEach((issue, key) => {
        //const shortKey = `#${issue.number}`;

        if (
            !explicitNowKeys.has(key) &&
            !previousExplicit.has(key)
        ) {
            uiNowMap.set(key, issue);
        }
    });

    // -------------------------------------------------
    // 6️⃣ Формуємо фінальний список
    // -------------------------------------------------
    const finalMap = new Map();

    // Closes
    explicitNowMap.forEach((issue, key) => {
        finalMap.set(key, {
            ...issue,
            displaySource: "explicit",
        });
    });

    // Linked
    uiNowMap.forEach((issue, key) => {
        if (!finalMap.has(key)) {
            finalMap.set(key, {
                ...issue,
                displaySource: "ui",
            });
        }
    });

    const finalIssues = Array.from(finalMap.values());

    // -------------------------------------------------
    // 7️⃣ Формуємо infoBlock
    // -------------------------------------------------
    let infoBlock;

    if (finalIssues.length === 0) {
        infoBlock = buildInfoBlock({
            type: "caution",
            content:
                "Pull Request не містить посилань на пов’язані задачі.\n" +
                "Для проходження автоматизації необхідно додати reference на GitHub Issue у форматі URL.",
        });
    } else {
        infoBlock = buildInfoBlock({
            type: "note",
            content: formatIssuesContent(finalIssues),
        });
    }

    const updatedBody = `${cleanBody}\n\n${infoBlock}`.trim();

    // -------------------------------------------------
    // 8️⃣ Update тільки якщо є зміни
    // -------------------------------------------------
    if (updatedBody !== originalBody.trim()) {
        await github.rest.pulls.update({
            owner,
            repo,
            pull_number: pr.number,
            body: updatedBody,
        });

        core.notice("PR body updated with delta-based issue sync.");
    } else {
        core.notice("PR body is already up to date.");
    }
}