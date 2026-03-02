//syncPRBody.mjs
import {buildInfoBlock, removeInfoBlocks} from "../helpers/buildInformBlock.mjs";

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
            lines.push(``);
            lines.push(`**Repository: ${repoKey}**`);
        }
        for (const issue of repoIssues) {
            lines.push(
                `Closes: [${issue.title} #${issue.number}](${issue.url})`
            );
        }
    }
    return lines.join("\n");
}


export async function syncPRBody(github, pr, issues, core) {

    const originalBody = pr.body ?? "";
    const cleanBody = removeInfoBlocks(pr.body ?? "");
    let infoBlock;

    if (issues.length === 0) {
        infoBlock = buildInfoBlock({
            type: "caution",
            content: "Pull Request не містить посилань на пов’язані задачі.\nДля проходження автоматизації необхідно додати reference на GitHub Issue у форматі URL."
        });
    } else {
        infoBlock = buildInfoBlock({
            type: "note",
            content: formatIssuesContent(issues)
        });
    }

    const updatedBody = `${cleanBody}\n\n${infoBlock}`.trim();
    if (updatedBody !== originalBody) {
        await github.rest.pulls.update({
            owner: pr.base.repo.owner.login,
            repo: pr.base.repo.name,
            pull_number: pr.number,
            body: updatedBody
        });
        core.notice("PR body updated.");
    } else {
        core.notice("PR body already up to date.");
    }
}