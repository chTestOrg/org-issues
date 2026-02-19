import {logGroup} from "./logger.mjs";
import { buildInfoBlock, removeBlocks } from "./info-blocks.mjs";


/**
 * Парсить body PR та повертає унікальні issue-посилання по ключу owner/repo.
 */
function extractIssuesByRepo(body) {
    const issueRegex = /https?:\/\/github\.com\/([^/\s]+)\/([^/\s]+)\/issues\/(\d+)\b/gi;
    const issuesByRepo = new Map();

    for (const match of body.matchAll(issueRegex)) {
        const owner = match[1];
        const repo = match[2];
        const number = Number(match[3]);
        if (!owner || !repo || !number) continue;

        const repoKey = `${owner}/${repo}`.toLowerCase();
        if (!issuesByRepo.has(repoKey)) {
            issuesByRepo.set(repoKey, {
                owner,
                repo,
                numbers: new Set(),
            });
        }

        issuesByRepo.get(repoKey).numbers.add(number);
    }

    return issuesByRepo;
}

/**
 * Збагачує issue-посилання через GitHub API та готує секції для інформаційного блоку.
 */
async function buildIssueSections(github, issuesByRepo, core) {
    const sections = [];

    for (const issueGroup of issuesByRepo.values()) {
        const numbers = Array.from(issueGroup.numbers).sort((a, b) => a - b);

        const issues = await Promise.all(numbers.map(async (number) => {
            try {
                const { data } = await github.rest.issues.get({
                    owner: issueGroup.owner,
                    repo: issueGroup.repo,
                    issue_number: number,
                });

                return {
                    number,
                    title: data.title,
                    url: `https://github.com/${issueGroup.owner}/${issueGroup.repo}/issues/${number}`,
                };
            } catch {
                core.warning(`Cannot access ${issueGroup.owner}/${issueGroup.repo}#${number}`);
                return null;
            }
        }));

        const availableIssues = issues.filter(Boolean);
        if (availableIssues.length === 0) continue;

        sections.push({
            owner: issueGroup.owner,
            repo: issueGroup.repo,
            issues: availableIssues,
        });
    }

    return sections.sort((a, b) => {
        const left = `${a.owner}/${a.repo}`.toLowerCase();
        const right = `${b.owner}/${b.repo}`.toLowerCase();
        return left.localeCompare(right);
    });
}

async function syncPrBodyIfChanged({ github, owner, repo, prNumber, originalBody, updatedBody }) {
    if (updatedBody === originalBody) {
        return false;
    }

    await github.rest.pulls.update({
        owner,
        repo,
        pull_number: prNumber,
        body: updatedBody,
    });

    return true;
}

export default async function prVerifyLinkedIssues({ github, context, core }) {
    const pr = context.payload.pull_request;
    if (!pr) {
        core.notice("Skipped: event is not a pull request.");
        return;
    }

    const owner = context.repo.owner;
    const repo = context.repo.repo;
    const prNumber = pr.number;

    await logGroup(core, `PR #${prNumber} linked issues validation`, async () => {
        core.info("Step 1/4: Fetch current PR body");
        const { data: currentPr } = await github.rest.pulls.get({
            owner,
            repo,
            pull_number: prNumber,
        });

        const originalBody = currentPr.body ?? "";
        const cleanBody = removeBlocks(originalBody);

        core.info("Step 2/4: Parse linked GitHub Issues URLs");
        const issuesByRepo = extractIssuesByRepo(cleanBody);
        const reposWithLinks = issuesByRepo.size;
        const totalLinks = Array.from(issuesByRepo.values()).reduce(
            (acc, issueGroup) => acc + issueGroup.numbers.size,
            0
        );
        core.info(`Parsed ${totalLinks} unique issue link(s) across ${reposWithLinks} repos.`);

        core.info("Step 3/4: Validate issue links and prepare content block");
        if (totalLinks === 0) {
            const warningBlock = buildInfoBlock({ type: "warning" });
            const updatedBody = `${warningBlock}\n\n${cleanBody}`.trim();
            const changed = await syncPrBodyIfChanged({
                github,
                owner,
                repo,
                prNumber,
                originalBody,
                updatedBody,
            });
            core.notice(changed ? "Result: WARNING block synced." : "Result: WARNING block already up to date.");

            core.setFailed("Validation Error: No linked GitHub issues found.");
            return;
        }

        const sections = await buildIssueSections(github, issuesByRepo, core);
        const accessibleIssuesCount = sections.reduce((acc, section) => acc + section.issues.length, 0);
        core.info(`Accessible issues: ${accessibleIssuesCount}/${totalLinks}.`);

        if (sections.length === 0) {
            const warningBlock = buildInfoBlock({ type: "warning" });
            const updatedBody = `${warningBlock}\n\n${cleanBody}`.trim();
            const changed = await syncPrBodyIfChanged({
                github,
                owner,
                repo,
                prNumber,
                originalBody,
                updatedBody,
            });
            core.notice(changed ? "Result: WARNING block synced." : "Result: WARNING block already up to date.");

            core.setFailed("Validation Error: Linked issues are not accessible.");
            return;
        }

        core.info("Step 4/4: Sync IMPORTANT block");
        const importantBlock = buildInfoBlock({ type: "important", sections });
        const updatedBody = `${cleanBody}\n\n${importantBlock}`.trim();
        const changed = await syncPrBodyIfChanged({
            github,
            owner,
            repo,
            prNumber,
            originalBody,
            updatedBody,
        });
        core.notice(changed ? "Result: IMPORTANT block synced." : "Result: PR body already up to date.");
    });
}
