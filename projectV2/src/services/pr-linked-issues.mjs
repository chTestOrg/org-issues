import { getIssueTitle } from "../api/getPullRequest.mjs";
import { buildImportantBlock } from "../helpers/blocks.mjs";
import { extractIssuesFromBody } from "../helpers/parseIssuesLinks.mjs";

export async function buildLinkedIssuesBlock(github, { owner, body, core }) {
    const issuesByRepo = extractIssuesFromBody(body, owner);

    if (issuesByRepo.size === 0) {
        return null;
    }

    const sections = [];

    for (const [repo, numbers] of issuesByRepo.entries()) {
        const issues = [];

        for (const number of numbers) {
            try {
                const title = await getIssueTitle(github, {
                    owner,
                    repo,
                    issueNumber: number,
                });

                issues.push({ number, title });
            } catch {
                if (core) {
                    core.warning(`Cannot access ${repo}#${number}`);
                }
            }
        }

        if (issues.length) {
            sections.push({
                repo,
                issues: issues.sort((a, b) => a.number - b.number),
            });
        }
    }

    if (sections.length === 0) {
        return null;
    }

    sections.sort((a, b) => a.repo.localeCompare(b.repo));
    return buildImportantBlock(owner, sections);
}
