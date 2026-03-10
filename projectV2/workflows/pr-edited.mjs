// projectV2/workflows/pr-edited.mjs

import { logGroup } from "../utils/logger.mjs";

export default async function prEdited({ github, context, core, githubToken }) {

    await logGroup(core, "Create PR context", async () => {

        const pr = context.payload.pull_request;

        const ctx = {
            github,
            core,
            owner: context.repo.owner,
            repo: context.repo.repo,
            prNumber: pr.number,
            prTitle: pr.title,
            prData: null,
            prBody: "",
            headRef: null,
            baseRef: null,
        };

        ctx.prData = pr;
        ctx.prBody = pr.body ?? "";

        core.info(`PR title: ${ctx.prTitle}`);
        core.info(`PR body length: ${ctx.prBody.length}`);

        // рядок який хочемо додати
        const newLine = `\n\n---\n🤖 Updated by automation at ${new Date().toISOString()}`;

        const updatedBody = ctx.prBody + newLine;

        await github.rest.pulls.update({
            owner: ctx.owner,
            repo: ctx.repo,
            pull_number: ctx.prNumber,
            body: updatedBody,
        });

        core.notice("✅ PR body updated successfully");

    });
}