import {config} from '../config/project-org-dev-board.mjs';

export default async ({github, context, core}) => {
    try {
        const owner = context.repo.owner;
        const repo = context.repo.repo;

        // Додаємо перевірку на наявність PR (safety check)
        if (!context.payload.pull_request) {
            core.notice("This action was not triggered by a Pull Request. Skipping.");
            return;
        }

        const prNumber = Number(context.payload.pull_request.number);
        const project = config.project;

        // Зручне витягування ID через об'єктний конфіг
        const PROJECT_ID = project.id;
        const STATUS_FIELD_ID = project.fields.status.id;
        const QA_OPTION_ID = project.fields.status.options.qa;
        const QA_STATUS_FIELD_ID = project.fields.status_qa_board.id;
        const QA_TODO_OPTION_ID = project.fields.status_qa_board.options.todo;

        core.startGroup("Workflow Inputs");
        core.info(`Repository: ${owner}/${repo}`);
        core.info(`PR: #${prNumber}`);
        core.info(`Target Project: ${project.title}`);
        core.endGroup();

        const query = `
                query($owner: String!, $repo: String!, $prNumber: Int!) {
                  repository(owner: $owner, name: $repo) {
                    pullRequest(number: $prNumber) {
                      closingIssuesReferences(first: 50) {
                        nodes {
                          id
                          number
                          projectItems(first: 10) {
                            nodes {
                              id
                              project { id }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              `;

        const mutation = `
                mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
                  updateProjectV2ItemFieldValue(input: {
                    projectId: $projectId,
                    itemId: $itemId,
                    fieldId: $fieldId,
                    value: { singleSelectOptionId: $optionId }
                  }) {
                    projectV2Item { id }
                  }
                }
              `;

        const res = await github.graphql(query, {owner, repo, prNumber});
        const issues = res?.repository?.pullRequest?.closingIssuesReferences?.nodes || [];

        if (issues.length === 0) {
            core.notice("No linked issues found (using 'Closes #123' syntax).");
            return;
        }

        core.info(`Found ${issues.length} linked issue(s).`);
        const errors = [];

        for (const issue of issues) {
            core.startGroup(`Processing Issue #${issue.number}`);
            const items = issue.projectItems?.nodes || [];

            // Фільтруємо ітеми, що належать саме нашому проекту
            const relevantItems = items.filter(item => item.project?.id === PROJECT_ID);

            if (relevantItems.length === 0) {
                core.info(`Issue #${issue.number} is not part of project ${project.title}.`);
            }

            const updateField = async (label, params) => {
                try {
                    await github.graphql(mutation, params);
                    // Використовуємо params.itemId, бо він точно є в об'єкті
                    core.info(`✅ Item "${params.itemId}" updated ${label} to "${params.optionName}"`);
                } catch (err) {
                    const msg = `❌ Item "${params.itemId}" failed update ${label} to "${params.optionName}": ${err.message}`;
                    core.error(msg);
                    errors.push(msg);
                }
            };

            for (const item of relevantItems) {
                core.info(`▶️ Processing item: ${item.id}`);

                await updateField("DEV Board Status", {
                    projectId: PROJECT_ID,
                    itemId: item.id,
                    fieldId: STATUS_FIELD_ID,
                    optionId: QA_OPTION_ID.id,
                    optionName: QA_OPTION_ID.name
                });

                await updateField("QA Board Status", {
                    projectId: PROJECT_ID,
                    itemId: item.id,
                    fieldId: QA_STATUS_FIELD_ID,
                    optionId: QA_TODO_OPTION_ID.id,
                    optionName: QA_TODO_OPTION_ID.name
                });
            }
            core.endGroup();
        }

        // Якщо були помилки під час ітерацій — фейлимо весь крок в кінці
        if (errors.length > 0) {
            core.setFailed(`Completed with ${errors.length} error(s). Check logs above.`);
        } else {
            core.notice("Successfully moved all linked issues to QA!");
        }

    } catch (err) {
        core.setFailed(`Script fatal error: ${err.message}`);
    }
}