import { config } from '../config/project-org-dev-board.mjs';
import { getClosingIssuesReferences } from '../api-graphql/getClosingIssuesReferences.mjs';
import { updateSingleSelectField } from '../api-graphql/updateSingleSelectField.mjs';
import { logGroup } from '../utils/logger.mjs';

export default async function projectPrMerged({ github, context, core }) {
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
        const QA_OPTION = project.fields.status.options.qa;

        const QA_STATUS_FIELD_ID = project.fields.status_qa_board.id;
        const QA_TODO_OPTION = project.fields.status_qa_board.options.todo;

        const BRANCH_FIELD_ID = project.fields.branch.id
        const BRANCH_OPTIONS = project.fields.branch.options

        await logGroup(core, "Fetch closing issues", async () => {

            const baseBranch = context.payload.pull_request.base.ref;
            core.info(`PR merged into branch: ${baseBranch}`);

            // Шукаємо опцію в конфігу, назва якої відповідає гілці
            const targetBranchOption = Object.values(BRANCH_OPTIONS).find(
                (opt) => opt.name === baseBranch
            );

            if (!targetBranchOption) {
                core.warning(`No project option found for branch: ${baseBranch}`);
            }

            const { merged, issues } = await getClosingIssuesReferences(github, {
                owner,
                repo,
                prNumber
            });

            if (!merged) {
                core.notice("PR is not merged. Skipping.");
                return;
            }

            if (issues.length === 0) {
                core.notice("No linked issues found.");
                return;
            }

            core.info(`Found ${issues.length} issue(s).`);

            //const items = getProjectItemsForIssues(issues, PROJECT_ID);

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
                            optionId: QA_OPTION.id
                        });
                        core.info(`✅ Item "${itemId}" updated "DEV Board Status" to "${QA_OPTION.name}"`);

                        await updateSingleSelectField(github, {
                            projectId: PROJECT_ID,
                            itemId,
                            fieldId: QA_STATUS_FIELD_ID,
                            optionId: QA_TODO_OPTION.id
                        });
                        core.info(`✅ Item "${itemId}" updated "QA Board Status" to "${QA_TODO_OPTION.name}"`);

                        await updateSingleSelectField(github, {
                            projectId: PROJECT_ID,
                            itemId,
                            fieldId: BRANCH_FIELD_ID,
                            optionId: targetBranchOption.id
                        });
                        core.info(`✅ Item "${itemId}" updated "Branch" to "${targetBranchOption.name}"`);

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
