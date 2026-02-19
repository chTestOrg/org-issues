import { logGroup } from "../utils/logger.mjs";
import { buildWarningBlock, IMPORTANT, removeBlocks, WARNING } from "../helpers/blocks.mjs";
import { getPrBody, updatePrBody } from "../api/getPullRequest.mjs";
import { buildLinkedIssuesBlock } from "../services/pr-linked-issues.mjs";

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

        // 3️⃣ Бізнес-логіка: побудувати блок з задачами
        const importantBlock = await buildLinkedIssuesBlock(github, {
            owner,
            body: cleanBody,
            core,
        });

        // 4️⃣ Якщо немає — WARNING
        if (!importantBlock) {
            const updatedBody = `${buildWarningBlock()}\n\n${cleanBody}`;

            if (updatedBody !== originalBody) {
                await updatePrBody(github, { owner, repo, prNumber, body: updatedBody });
                core.notice("WARNING block added");
            } else {
                core.info("No changes");
            }

            return;
        }

        // 5️⃣ IMPORTANT block
        const updatedBody = `${cleanBody}\n\n${importantBlock}`;

        if (updatedBody === originalBody) {
            core.info("PR body up to date");
            return;
        }

        await updatePrBody(github, { owner, repo, prNumber, body: updatedBody });
        core.notice("Linked issues synchronized");
    });
};
