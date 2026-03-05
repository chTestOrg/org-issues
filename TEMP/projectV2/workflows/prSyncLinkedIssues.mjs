//prSyncLinkedIssues.mjs
import {logGroup} from '../utils/logger.mjs';
import {syncPRBody} from "../services/syncPRBody.mjs";
import {getLinkedIssuesRefs} from "../services/getLinkedIssuesRefs.mjs";
import {removeInfoBlocks} from "../helpers/buildInformBlock.mjs";

export default async function prSyncLinkedIssues({github, context, core}) {

    const pr = context.payload.pull_request;
    if (!pr) {
        core.warning("Skipped: not a PR event.");
        return;
    }

    const owner = context.repo.owner;
    const repo = context.repo.repo;
    const prNumber = pr.number;

    await logGroup(core, `PR #${prNumber} linked issues sync`, async () => {

        core.notice("1️⃣ Fetch PR data");
        const {data: currentPr} = await github.rest.pulls.get({owner, repo, pull_number: prNumber,});

        const originalBody = currentPr.body ?? "";
        const cleanBody = removeInfoBlocks(originalBody);


        core.notice("2️⃣ getLinkedIssuesRefs");
        const issues = await getLinkedIssuesRefs(github, currentPr, core);

        core.info("5️⃣ Fetch full issue data via REST");
        const enrichedIssues = [];
        for (const issue of issues) {
            try {
                const {data} = await github.rest.issues.get({
                    owner: issue.owner,
                    repo: issue.repo,
                    issue_number: issue.number
                });
                issues.push({
                    owner: issue.owner,
                    repo: issue.repo,
                    number: issue.number,
                    title: data.title,
                    url: data.html_url
                });

                core.info(`✔ ${issue.owner}/${issue.repo}#${issue.number}`);

            } catch (err) {
                core.warning(
                    `Cannot access ${issue.owner}/${issue.repo}#${issue.number}`
                );
            }
        }
        core.notice("3️⃣  syncPRBody");
        await syncPRBody(github, currentPr, enrichedIssues, core);

        // 4️⃣ ЕТАП ЛОГІКИ: Валідація (на основі отриманих даних)
        if (issues.length === 0) {
            core.setFailed("No linked issues found.");
            return;
        }

        // 5️⃣ ЕТАП ПРОЕКТУ: Рух по дошці
        // await moveIssuesToReview(github, issues, core);
    });
}