import { logGroup } from "../../../projectV2/src/utils/logger.mjs";
import {
    buildImportantBlock,
    buildWarningBlock,
    extractIssues,
    stripAutoBlocks
} from "../../../projectV2/src/helpers/pr-verify-linked-issues.helpers.mjs";

async function getPrBody(github, { owner, repo, prNumber }) {
    const { data: pr } = await github.rest.pulls.get({
        owner,
        repo,
        pull_number: prNumber,
    });

    return pr.body ?? "";
}

async function updatePrBody(github, { owner, repo, prNumber, body }) {
    await github.rest.pulls.update({
        owner,
        repo,
        pull_number: prNumber,
        body,
    });
}

async function fetchIssueTitles(github, owner, issuesByRepo) {
    const result = [];

    for (const [repo, numbers] of issuesByRepo.entries()) {
        const issues = await Promise.all(
            Array.from(numbers).map(async (num) => {
                try {
                    const { data } = await github.rest.issues.get({
                        owner,
                        repo,
                        issue_number: num,
                    });
                    return { number: num, title: data.title };
                } catch {
                    return null;
                }
            })
        );

        const valid = issues.filter(Boolean).sort((a, b) => a.number - b.number);

        if (valid.length) {
            result.push({ repo, issues: valid });
        }
    }

    return result.sort((a, b) => a.repo.localeCompare(b.repo));
}

export default async function prIssuesVerifyV2({ github, context, core }) {
    if (!context.payload.pull_request) {
        core.notice("Not a PR event. Skipping.");
        return;
    }

    const owner = context.repo.owner;
    const repo = context.repo.repo;
    const prNumber = context.payload.pull_request.number;

    await logGroup(core, `Verify linked issues for PR #${prNumber}`, async () => {
        const originalBody = await getPrBody(github, { owner, repo, prNumber });
        const body = stripAutoBlocks(originalBody);
        const issuesByRepo = extractIssues(body, owner);

        if (issuesByRepo.size === 0) {
            core.info("No issues found → adding WARNING block");

            const updatedBody = `${buildWarningBlock()}\n\n${body}`;

            if (updatedBody !== originalBody) {
                await updatePrBody(github, { owner, repo, prNumber, body: updatedBody });
            }

            return;
        }

        core.info(`Found issues in ${issuesByRepo.size} repo(s)`);

        const sections = await fetchIssueTitles(github, owner, issuesByRepo);

        if (sections.length === 0) {
            core.notice("Issues not accessible → skipping IMPORTANT block");
            return;
        }

        const importantBlock = buildImportantBlock(owner, sections);
        const updatedBody = `${body}\n\n${importantBlock}`;

        if (updatedBody === originalBody) {
            core.info("PR body already up to date");
            return;
        }

        await updatePrBody(github, { owner, repo, prNumber, body: updatedBody });

        core.notice("Linked issues block synchronized");
    });
}
