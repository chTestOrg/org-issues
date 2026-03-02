// projectV2/src/workflow-handler.mjs
import {logGroup} from "./utils/logger.mjs";
import prOpened from "./workflows/pr-opened.mjs";

export default async function processEvent({github, context, core}) {
    await logGroup(core, "GitHub Project Automation", async () => {
        const {action, pull_request} = context.payload;
        const repoName = context.repo.repo;

        core.info(`Event: ${context.eventName}.${action} | Repo: ${repoName}`);

        switch (action) {
            case 'opened':
                await logGroup(core, "Step: PR Opened", () =>
                    prOpened({github, context, core})
                );
                break;

            case 'edited':
                core.info("PR edited. No specific automation defined yet.");
                break;

            case 'synchronize':
                core.info("PR synchronized. No specific automation defined yet.");
                break;

            case 'closed':
                if (pull_request?.merged) {
                    core.info("PR closed & merged. No specific automation defined yet.");
                }
                break;

            default:
                core.info(`No automation for action: ${action}`);
        }
    });
}