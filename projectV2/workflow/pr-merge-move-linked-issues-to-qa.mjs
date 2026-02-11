import { config } from '../config/project-org-dev-board.mjs';

export default async ({ github, context, core }) => {
    try {
        const owner = context.repo.owner;
        const repo = context.repo.repo;
        const prNumber = Number(context.payload.pull_request.number);

        const project = config.project;

        const PROJECT_ID = project.id;
        const STATUS_FIELD_ID = project.fields.status.id;
        const QA_OPTION_ID = project.fields.status.options.qa;
        const QA_STATUS_FIELD_ID = project.fields.status_qa_board.id;
        const QA_TODO_OPTION_ID = project.fields.status_qa_board.options.todo;

        core.startGroup("Inputs");
        core.info(`Repository: ${owner}/${repo}`);
        core.info(`PR: #${prNumber}`);
        //core.info(`Config: ${configPath}`);
        core.endGroup();

        const query = `
                query($owner: String!, $repo: String!, $prNumber: Int!) {
                  repository(owner: $owner, name: $repo) {
                    pullRequest(number: $prNumber) {
                      id
                      title
                      closingIssuesReferences(first: 50) {
                        nodes {
                          id
                          number
                          url
                          projectItems(first: 20) {
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
        const pr = res?.repository?.pullRequest;
        if (!pr) {
            core.warning("Pull request not found in GraphQL response.");
            return;
        }

        const issues = pr.closingIssuesReferences?.nodes || [];
        if (issues.length === 0) {
            core.notice("No linked/closing issues found for this PR.");
            return;
        }

        core.info(`Found ${issues.length} linked issue(s).`);

        for (const issue of issues) {
            core.startGroup(`Issue #${issue.number}`);
            const items = issue.projectItems?.nodes || [];
            if (items.length === 0) {
                core.info("No project items found for this issue.");
                core.endGroup();
                continue;
            }

            for (const item of items) {
                if (item.project?.id === PROJECT_ID) {
                    try {
                        await github.graphql(mutation, {
                            projectId: PROJECT_ID,
                            itemId: item.id,
                            fieldId: STATUS_FIELD_ID,
                            optionId: QA_OPTION_ID
                        });
                        core.info(`Status moved to QA for item ${item.id}.`);
                    } catch (mutErr) {
                        core.error(`Failed to update status for item ${item.id}: ${mutErr.message || mutErr}`);
                        continue;
                    }

                    try {
                        await github.graphql(mutation, {
                            projectId: PROJECT_ID,
                            itemId: item.id,
                            fieldId: QA_STATUS_FIELD_ID,
                            optionId: QA_TODO_OPTION_ID
                        });
                        core.info(`QA Status set to Todo for item ${item.id}.`);
                        core.notice(`Item ${item.id} fully updated.`);
                    } catch (mutErr) {
                        core.error(`Failed to update QA status for item ${item.id}: ${mutErr.message || mutErr}`);
                    }
                } else {
                    // Якщо item знайдений, але в іншому проекті
                    core.info(`Item ${item.id} is in project ${item.project?.id} (skipped).`);
                }
            } // projectItems
            core.endGroup();
        } // issues

    } catch (err) {
        core.setFailed(`Script failed: ${err.message || err}`);
    }
}
