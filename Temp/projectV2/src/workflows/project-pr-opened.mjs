import {config} from "../../config/project-org-dev-board.mjs";
import {logGroup} from "../utils/logger.mjs";
import {getClosingIssuesReferences} from "../api/getClosingIssuesReferences.mjs";
import {updateSingleSelectField} from "../api/updateSingleSelectField.mjs";
import prVerifyLinkedIssues from "./pr-verify-linked-issues.mjs";

export default async function projectPrOpened({ github, context, core }) {
    try {
        if (!context.payload.pull_request) {
            core.notice("Not a PR event. Skipping.");
            return;
        }

        const owner = context.repo.owner;
        const repo = context.repo.repo;
        const prNumber = context.payload.pull_request.number;

        const project = config.project;

        const PROJECT_ID = project.id;
        const DEV_STATUS_FIELD_ID = project.fields.status.id;
        const DEV_STATUS_FIELD_OPTION = project.fields.status.options;

        await prVerifyLinkedIssues({github, context, core});

/*        await logGroup(core, "Fetch closing issues", async () => {

            const parseIssuesLink = await prVerifyLinkedIssues({github, context, core});

            const { issues } = await getClosingIssuesReferences(github, {
                owner,
                repo,
                prNumber
            });

            if (issues.length === 0) {
                core.notice("No linked issues found.");
                return;
            }

            core.info(`Found ${issues.length} issue(s).`);

            const items = [];

            for (const issue of issues) {
                const issueItems = issue.projectItems?.nodes || [];

                for (const item of issueItems) {
                    if (item.project?.id === PROJECT_ID) {
                        items.push({
                            issueNumber: issue.number,
                            itemId: item.id
                        });
                    }
                }
            }

            if (items.length === 0) {
                core.notice("No project items found for configured project.");
                return;
            }

            const errors = [];

            for (const { issueNumber, itemId } of items) {
                await logGroup(core, `Issue #${issueNumber}`, async () => {
                    try {
                        await updateSingleSelectField(github, {
                            projectId: PROJECT_ID,
                            itemId,
                            fieldId: DEV_STATUS_FIELD_ID,
                            optionId: DEV_STATUS_FIELD_OPTION.review.id
                        });
                        core.info(`✅ Item "${itemId}" updated "DEV Board Status" to "${DEV_STATUS_FIELD_OPTION.review.name}"`);

                    } catch (err) {
                        const msg = `❌ Failed for item ${itemId}: ${err.message}`;
                        core.error(msg);
                        errors.push(msg);
                    }
                });
            }

            if (errors.length > 0) {
                core.setFailed(`Completed with ${errors.length} error(s).`);
            } else {
                core.notice("All issues moved to QA successfully.");
            }
        });*/
    } catch (err) {
        core.setFailed(`Fatal error: ${err.message}`);
    }
};