import {logGroup} from "./utils/logger.mjs";

export default async function test({ context, core }) {
    await logGroup(core, "Check base branch", async () => {

        const pr = context.payload.pull_request;

        if (!pr) {
            core.setFailed("This workflow is not triggered by a pull_request event.");
            return;
        }

        const baseBranch = pr.base.ref; // куди мержиться
        const headBranch = pr.head.ref; // звідки мержиться

        core.notice(`Base branch: ${baseBranch}`);
        core.notice(`Head branch: ${headBranch}`);
    });
}
