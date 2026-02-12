import { config } from '../config/project-org-dev-board.mjs';

export default async ({ github, context, core }) => {
    try {
        const owner = context.repo.owner;
        const repo = context.repo.repo;

        // Додаємо перевірку на наявність PR (safety check)
        if (!context.payload.pull_request) {
            core.notice("This action was not triggered by a Pull Request. Skipping.");
            return;
        }

        const prNumber = Number(context.payload.pull_request.number);
        const targetBranch = context.payload.pull_request.base.ref;

        const project = config.project;

        const PROJECT_ID = project.id;
        const ENV_FIELD_ID = project.fields.environment.id;
        const STAGE_OPTION_ID = project.fields.environment.options.stage.id;
        const PRERELEASE_OPTION_ID= project.fields.environment.options.prerelease.id;

        core.startGroup("Workflow Inputs");
        core.info(`Repository: ${owner}/${repo}`);
        core.info(`PR: #${prNumber}`);
        core.info(`Target Branch: ${targetBranch}`);
        core.info(`Project: ${project.title}`);
        core.endGroup();

        const getLinkedItemsQuery = `
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

        const getFieldValueQuery = `
          query($itemId: ID!, $fieldId: ID!) {
            node(id: $itemId) {
              ... on ProjectV2Item {
                id
                field: fieldValues(first: 1, filterBy: { fieldId: $fieldId }) {
                  nodes {
                    ... on ProjectV2ItemFieldSingleSelectValue {
                      id
                      name
                    }
                  }
                }
              }
            }
          }
        `;
        const res = await github.graphql(getLinkedItemsQuery, { owner, repo, prNumber });
        const issues = res.repository.pullRequest.closingIssuesReferences?.nodes || [];

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

            for (const item of relevantItems) {
                const { node: projectItem } = await github.graphql(getFieldValueQuery, {
                    itemId: item.id,
                    fieldId: ENV_FIELD_ID
                });
                const envField = projectItem.environment.nodes[0];
                const envId = envField?.id;

                let allowed = false;
                if (envId === STAGE_OPTION_ID && targetBranch === "develop") allowed = true;
                if (envId === PRERELEASE_OPTION_ID && targetBranch === "prerelease") allowed = true;
                if (!envId && targetBranch === "develop") allowed = true;

                if (!allowed) {
                    const msg = `❌ PR #${prNumber} cannot be merged into "${targetBranch}" because linked item ${item.id} has environment "${envField?.name || 'unset'}"`;
                    core.error(msg);
                    errors.push(msg);
                } else {
                    core.info(`✅ Linked item ${item.id} with environment "${envField?.name || 'unset'}" allows merge into "${targetBranch}"`);
                }
            }
        }

        if (errors.length > 0) {
            core.setFailed(`Merge verification failed. ${errors.length} issue(s) block the merge.`);
        } else {
            core.notice("All linked issues allow merge!");
        }

    } catch (err) {
        core.setFailed(`Script fatal error: ${err.message}`);
    }
};
