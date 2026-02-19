import {config} from '../config/project-org-dev-board.mjs';
import {getClosingIssuesReferences} from '../api-graphql/getClosingIssuesReferences.mjs';
import {updateSingleSelectField} from '../api-graphql/updateSingleSelectField.mjs';
import {logGroup} from '../utils/logger.mjs';
import {parseLinkedIssues} from "../helpers/parseLinkedIssues.mjs";

export default async function projectPrOpened({github, context, core}) {
    try {
        if (!context.payload.pull_request) {
            core.notice("Not a PR event. Skipping.");
            return;
        }

        const owner = context.repo.owner;
        const repo = context.repo.repo;
        const pull_number = context.payload.pull_request.number;

        const project = config.project;

        const PROJECT_ID = project.id;
        const DEV_STATUS_FIELD_ID = project.fields.status.id;
        const DEV_STATUS_FIELD_OPTION = project.fields.status.options;

        const {data: currentPr} = await github.rest.pulls.get({owner, repo, pull_number,});
        const prBody = currentPr.body ?? "";

        await logGroup(core, "Fetch closing issues", async () => {

            //const parseIssuesLink = await prVerifyLinkedIssues({github, context, core});
            const issuesLinked = parseLinkedIssues(prBody)
            const issuesReferences = await getClosingIssuesReferences(github, {owner, repo, pull_number});

            if (issuesLinked.length === 0 || issuesReferences.length === 0) {
                core.notice("No linked issues found.");
                return;
            }

            core.info(`Found ${issuesLinked.length} issue(s).`);
            core.info(`Found ${issuesReferences.length} issue(s).`);

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

            for (const {issueNumber, itemId} of items) {
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
        });
    } catch (err) {
        core.setFailed(`Fatal error: ${err.message}`);
    }
};
