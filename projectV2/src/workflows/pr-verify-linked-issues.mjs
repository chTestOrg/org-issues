import {logGroup} from "../utils/logger.mjs";
import {buildWarningBlock, IMPORTANT, removeBlocks, WARNING,} from "../helpers/blocks.mjs";
import {getPrBody, updatePrBody} from "../api/getPullRequest.mjs";
import {extractIssuesFromPrBody} from "../helpers/parseIssues.mjs";

export default async function prVerifyLinkedIssues({ github, context, core }){
    if (!context.payload.pull_request) {
        core.notice("Not a PR event. Skipping.");
        return;
    }

    const owner = context.repo.owner;
    const repo = context.repo.repo;
    const prNumber = context.payload.pull_request.number;

    await logGroup(core, `PR #${prNumber} — verify linked issues`, async () => {
        // 1️⃣ Отримати PR
        const { body: originalBody } = await getPrBody(github, { owner, repo, prNumber });

        // 2️⃣ Очистити auto-блоки
        const cleanBody = removeBlocks(originalBody, [IMPORTANT, WARNING]);

        // 3️⃣ Дістати issues з body
        const issuesByRepo = extractIssuesFromPrBody(cleanBody, owner);

        // 4️⃣ Якщо немає — WARNING
        if (issuesByRepo.size === 0) {
            const updatedBody = `${buildWarningBlock()}\n\n${cleanBody}`;

            if (updatedBody !== originalBody) {
                await updatePrBody(github, { owner, repo, prNumber, body: updatedBody });
                core.notice("WARNING block added");
            } else {
                core.info("No changes");
            }

            return;
        }

        // 5️⃣ Завантажити titles
        const sections = [];

        for (const [repoName, numbers] of issuesByRepo.entries()) {
            const issues = [];

            for (const number of numbers) {
                try {
                    const title = await getIssueTitle(github, {
                        owner,
                        repo: repoName,
                        issueNumber: number,
                    });

                    issues.push({ number, title });
                } catch {
                    core.warning(`Cannot access ${repoName}#${number}`);
                }
            }

            if (issues.length) {
                sections.push({
                    repo: repoName,
                    issues: issues.sort((a, b) => a.number - b.number),
                });
            }
        }

        sections.sort((a, b) => a.repo.localeCompare(b.repo));

        if (sections.length === 0) {
            core.notice("No accessible issues");
            return;
        }

        // 6️⃣ IMPORTANT block
        const importantBlock = buildImportantBlock(owner, sections);
        const updatedBody = `${cleanBody}\n\n${importantBlock}`;

        if (updatedBody === originalBody) {
            core.info("PR body up to date");
            return;
        }

        await updatePrBody(github, { owner, repo, prNumber, body: updatedBody });
        core.notice("Linked issues synchronized");
    });
};
