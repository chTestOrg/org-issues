import {logGroup} from "../utils/logger.mjs";
import {buildImportantBlockV2, buildWarningBlock, IMPORTANT, removeBlocks, WARNING} from "../helpers/blocks.mjs";
import {getPrBody, updatePrBody} from "../api/getPullRequest.mjs";


export default async ({ github, context, core }) => {
    if (!context.payload.pull_request) {
        core.notice("Not a PR event. Skipping.");
        return;
    }

    const owner = context.repo.owner;
    const repo = context.repo.repo;
    const prNumber = context.payload.pull_request.number;

    await logGroup(core, `PR #${prNumber} — verify linked issues`, async () => {
        const { body: originalBody } = await getPrBody(github, { owner, repo, prNumber });

        const cleanBody = removeBlocks(originalBody, [IMPORTANT, WARNING]);

        const importantBlock = await buildImportantBlockV2(github, {
            owner,
            body: cleanBody,
        });

        // ❗ немає задач → WARNING
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

        const updatedBody = `${cleanBody}\n\n${importantBlock}`;

        if (updatedBody === originalBody) {
            core.info("PR body up to date");
            return;
        }

        await updatePrBody(github, { owner, repo, prNumber, body: updatedBody });
        core.notice("Linked issues synchronized");
    });
};
