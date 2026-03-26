// projectV2/src/workflow-handler.mjs
import {logGroup} from "./utils/logger.mjs";
import prOpened from "./workflows/pr-opened.mjs";
import prMerged from "./workflows/pr-merged.mjs";
import prEdited from "./workflows/pr-edited.mjs";

export default async function processEvent({github, context, core, githubToken}) {
    await logGroup(core, "GitHub Project Automation", async () => {
        const {action, pull_request, sender} = context.payload;

        const repoName = context.repo.repo;
        const prNumber = pull_request?.number;
        const prTitle = pull_request?.title;

        core.info(`🚀 Processing event pull request: "${action}" for "${repoName}"`);

        core.info(`githubApp Token exists: ${github ? "YES" : "NO"}`)
        core.info(`githubAction Token exists: ${githubToken ? "YES" : "NO"}`)

        core.info(`🔧 Pull request number: #${prNumber} - ${prTitle}`);
        core.info(`🔧 Pull request author: ${pull_request?.user?.type}`);
        core.info(`👤 Sender type: "${sender.type}" login "${sender.login}"`);
        core.info(`🌿 Source branch: ${pull_request.head.ref}`);
        core.info(`🎯 Target branch: ${pull_request.base.ref}`);
        core.info(`📦 Number of commits: ${pull_request.commits}`);

        if (sender.type === 'Bot' || pull_request?.user?.type === 'Bot') {
            core.info("🤖 Action triggered by a bot. Exiting silently.");
            return;
        }
        // Виводимо весь payload у форматі JSON
        core.info("Full context.payload:");
        core.info(JSON.stringify(context.payload, null, 2));

        switch (action) {
            case 'opened':
                await logGroup(core, "Step: PR Opened", () =>
                    prOpened({github, context, core, githubToken})
                );
                core.setFailed(true);
                core.notice("Success: PR Opened logic executed.");
                break;

            case 'edited':
                await logGroup(core, "Step: PR Edited", () =>
                    prEdited({github, context, core, githubToken})
                );
                core.notice("Success: PR Edited logic executed.");
                //core.notice("⏭️ Skipped: PR edited. No automation defined.");
                break;

            case 'synchronize':
                core.notice("⏭️ Skipped: PR synchronized. No automation defined.");
                break;

            case 'closed':
                if (pull_request?.merged) {
                    await logGroup(core, "Step: PR Edited", () =>
                        prMerged({github, context, core})
                    );
                    core.notice("Success: PR Merged logic executed.")
                    //core.warning("⚠️ Pending: PR merged, but automation is not yet implemented.");
                } else {
                    core.notice("⏭️ Skipped: PR closed without merging.");
                }
                break;

            default:
                core.info(`ℹ️ No automation for action: ${action}`);
        }
    });
    // Додаємо інформацію про ліміти в Summary
    await addFinalSummary({github, core, context});
}

async function addFinalSummary({github, core, context}) {
    try {
        const {data: {resources}} = await github.rest.rateLimit.get();
        const limit = resources.core;
        const resetDate = new Date(limit.reset * 1000).toLocaleTimeString();

        await core.summary
            .addHeading('🚀 Automation Summary')
            .addTable([
                ['Metric', 'Value'],
                ['Repository', context.repo.repo],
                ['Event', context.eventName],
                ['Action', context.payload.action],
                ['Actor', context.payload.sender.login]
            ])
            .addHeading('📊 API Rate Limits', 2)
            .addTable([
                ['Limit', 'Remaining', 'Used', 'Resets At'],
                [limit.limit.toString(), limit.remaining.toString(), limit.used.toString(), resetDate]
            ])
            .write();

        core.info(`🏁 Done. API Remaining: ${limit.remaining}`);
    } catch (error) {
        core.warning(`Could not generate summary: ${error.message}`);
    }
}