import {logGroup} from '../utils/logger.mjs';
import {stripAutoInfoBlocks} from "../helpers/buildInformBlock.mjs";

export default async function testBody({github, context, core}) {
    const pr = context.payload.pull_request;
    if (!pr) {
        core.notice("Skipped: not a PR event.");
        return;
    }

    const owner = context.repo.owner;
    const repo = context.repo.repo;
    const prNumber = pr.number;

    await logGroup(core, `PR #${prNumber} stripAutoInfoBlocks test`, async () => {

        core.info("1️⃣ Fetch PR data");

        const {data: currentPr} = await github.rest.pulls.get({
            owner,
            repo,
            pull_number: prNumber,
        });

        const originalBody = currentPr.body ?? "";

        core.info("----- RAW BODY START -----");
        core.info(originalBody || "(empty)");
        core.info("----- RAW BODY END -----");

        const cleanedBody = stripAutoInfoBlocks(originalBody);

        core.info("----- CLEAN BODY START -----");
        core.info(cleanedBody || "(empty)");
        core.info("----- CLEAN BODY END -----");
    });
}