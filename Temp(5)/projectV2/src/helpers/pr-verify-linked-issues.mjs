import { logGroup } from '../utils/logger.mjs';

const IMPORTANT_START = "<!-- AUTO-LINKED-ISSUES-START -->";
const IMPORTANT_END = "<!-- AUTO-LINKED-ISSUES-END -->";
const WARNING_START = "<!-- AUTO-WARNING-START -->";
const WARNING_END = "<!-- AUTO-WARNING-END -->";

function removeBlock(body, start, end) {
    const regex = new RegExp(`${start}[\\s\\S]*?${end}`, "m");
    return body.replace(regex, "").trim();
}

function extractIssues(body, owner) {
    const issueRegex = new RegExp(
        `https:\\/\\/github\\.com\\/${owner}\\/([\\w-]+)\\/issues\\/(\\d+)`,
        "gi"
    );

    const map = new Map();

    for (const match of body.matchAll(issueRegex)) {
        const repo = match[1];
        const num = Number(match[2]);
        if (!repo || !num) continue;

        if (!map.has(repo)) map.set(repo, new Set());
        map.get(repo).add(num);
    }

    return map;
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

function buildImportantBlock(owner, sections) {
    let block = `${IMPORTANT_START}
---
> [!IMPORTANT]
> ### Linked Issues:
`;

    for (const section of sections) {
        if (sections.length > 1) {
            block += `> **Repository: ${section.repo}**\n`;
        }

        for (const issue of section.issues) {
            block += `> Closes: [${issue.title} #${issue.number}](https://github.com/${owner}/${section.repo}/issues/${issue.number})\n`;
        }
    }

    block += `${IMPORTANT_END}`;
    return block;
}

function buildWarningBlock() {
    return `${WARNING_START}
---
> [!WARNING]
> Для повного процесу автоматизації цього пулреквеста необхідно прив’язати задачі у форматі GitHub Issues URL.
---
${WARNING_END}`;
}

export default async function prIssuesVerify ({ github, context, core }) {
    if (!context.payload.pull_request) {
        core.notice("Not a PR event. Skipping.");
        return;
    }

    const owner = context.repo.owner;
    const repo = context.repo.repo;
    const prNumber = context.payload.pull_request.number;

    await logGroup(core, `Verify linked issues for PR #${prNumber}`, async () => {
        const { data: pr } = await github.rest.pulls.get({
            owner,
            repo,
            pull_number: prNumber,
        });

        const originalBody = pr.body ?? "";

        let body = removeBlock(originalBody, IMPORTANT_START, IMPORTANT_END);
        body = removeBlock(body, WARNING_START, WARNING_END);

        const issuesByRepo = extractIssues(body, owner);

        if (issuesByRepo.size === 0) {
            core.info("No issues found → adding WARNING block");

            const updatedBody = `${buildWarningBlock()}\n\n${body}`;

            if (updatedBody !== originalBody) {
                await github.rest.pulls.update({
                    owner,
                    repo,
                    pull_number: prNumber,
                    body: updatedBody,
                });
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

        await github.rest.pulls.update({
            owner,
            repo,
            pull_number: prNumber,
            body: updatedBody,
        });

        core.notice("Linked issues block synchronized");
    });
};
