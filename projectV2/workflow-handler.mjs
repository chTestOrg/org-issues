// projectV2/src/workflow-handler.mjs
import {logGroup} from "./utils/logger.mjs";
import prOpened from "./workflows/pr-opened.mjs";

export default async function processEvent({github, context, core}) {
    await logGroup(core, "GitHub Project Automation", async () => {
        const {action, pull_request, sender} = context.payload;
        const repoName = context.repo.repo;

        if (sender.type === 'Bot') {
            core.info("🤖 Action triggered by a bot. Exiting silently to keep status green.");
            return;
        }

        // Початковий статус
        core.info(`🚀 Processing ${action} for ${repoName}`);

        switch (action) {
            case 'opened':
                await logGroup(core, "Step: PR Opened", () =>
                    prOpened({github, context, core})
                );
                // Додаємо анотацію про успіх
                core.notice("Success: PR Opened logic executed.");
                break;

            case 'edited':
                await logGroup(core, "Step: PR Edited", () =>
                    prOpened({github, context, core})
                );
                // Додаємо анотацію про успіх
                core.notice("Success: PR Edited logic executed.");
                // Відображаємо як пропущений/неактивний крок
                //core.notice("⏭️ Skipped: PR edited. No automation defined.");
                break;

            case 'synchronize':
                core.notice("⏭️ Skipped: PR synchronized. No automation defined.");
                break;

            case 'closed':
                if (pull_request?.merged) {
                    // Якщо логіки ще немає, але подія важлива - ставимо warning
                    core.warning("⚠️ Pending: PR merged, but automation is not yet implemented.");
                } else {
                    core.notice("⏭️ Skipped: PR closed without merging.");
                }
                break;

            default:
                core.info(`ℹ️ No automation for action: ${action}`);
        }
    });
    // Додаємо інформацію про ліміти в Summary
    await addFinalSummary({ github, core, context });
}

async function addFinalSummary({ github, core, context }) {
    try {
        const { data: { resources } } = await github.rest.rateLimit.get();
        const limit = resources.core;
        const resetDate = new Date(limit.reset * 1000).toLocaleTimeString();

        core.warning(`
Rate Limit Status:
------------------
Limit:     ${limit.limit}
Remaining: ${limit.remaining}
Used:      ${limit.used}
Resets At: ${resetDate}
------------------
        `);

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