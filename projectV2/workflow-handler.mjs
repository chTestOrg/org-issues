// projectV2/src/workflow-handler.mjs
import {logGroup} from "./utils/logger.mjs";
import prOpened from "./workflows/pr-opened.mjs";

export default async function processEvent({github, context, core}) {
    await logGroup(core, "GitHub Project Automation", async () => {
        const {action, pull_request} = context.payload;
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
}