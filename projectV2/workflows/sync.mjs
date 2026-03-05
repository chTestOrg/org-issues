/*
import {updateSingleSelectField} from "../api/graphql/updateSingleSelectField.mjs";
import {config} from "../config/project-7-config.mjs";

export async function getProjectItemsByStatus(github, projectId, fields) {

    const query = `
    query ($projectId: ID!) {
      node(id: $projectId) {
        ... on ProjectV2 {
          items(first: 100) {
            nodes {
              id
              content {
                ... on Issue {
                  number
                  title
                }
              }
              fieldValues(first: 20) {
                nodes {
                  ... on ProjectV2ItemFieldSingleSelectValue {
                    field {
                      ... on ProjectV2SingleSelectField {
                        id
                        name
                      }
                    }
                    optionId
                    name
                  }
                }
              }
            }
          }
        }
      }
    }`;

    const res = await github.graphql(query, { projectId });
    const items = res.node.items.nodes;
    return items.map(item => {
        let status = null;
        let statusQaBoard = null;
        for (const field of item.fieldValues.nodes) {
            if (field.field.id === fields.status.id) {
                status = field.name;
            }
            if (field.field.id === fields.status_qa_board.id) {
                statusQaBoard = field.name;
            }
        }
        return {
            itemId: item.id,
            issueNumber: item.content?.number,
            status,
            statusQaBoard
        };
    });
}

export async function sync({github, context, core}) {
    const PROJECT_ID = config.project.id
    const STATUS_FIELD = config.project.fields.status.id
    const QA_STATUS_ID = config.project.fields.status.options.qa.id

    const QA_BOARD_FIELD = config.project.fields.status_qa_board.id
    const TODO_OPTION = config.project.fields.status_qa_board.options.todo.id

    const items = await getProjectItemsByStatus(
        github,
        PROJECT_ID,
        config.project.fields
    );

    const itemsToUpdate = items.filter(item =>
        item.status === QA_STATUS_ID &&
        !item.statusQaBoard
    );

    for (const item of itemsToUpdate) {
        await updateSingleSelectField(github, {
            projectId: PROJECT_ID,
            itemId: item.itemId,
            fieldId: QA_BOARD_FIELD,
            optionId: TODO_OPTION
        });
    }
}*/

import {updateSingleSelectField} from "../api/graphql/updateSingleSelectField.mjs";
import {config} from "../config/project-org-dev-board.mjs";

/*
export async function getProjectItemsByStatus(github, projectId, fields, core) {
    core.info("Fetching project items via GraphQL...");
    const query = `
    query ($projectId: ID!) {
      node(id: $projectId) {
        ... on ProjectV2 {
          items(first: 100) {
            nodes {
              id
              content {
                ... on Issue {
                  number
                  title
                }
              }
              fieldValues(first: 20) {
                nodes {
                  ... on ProjectV2ItemFieldSingleSelectValue {
                    field {
                      ... on ProjectV2SingleSelectField {
                        id
                        name
                      }
                    }
                    optionId
                    name
                  }
                }
              }
            }
          }
        }
      }
    }`;

    const res = await github.graphql(query, { projectId });
    const items = res.node.items.nodes;
    core.info(`Total project items fetched: ${items.length}`);
    return items.map(item => {
        let status = null;
        let statusOptionId = null;
        let statusQaBoard = null;
        let statusQaBoardOptionId = null;

        for (const field of item.fieldValues.nodes) {
            if (field.field.id === fields.status.id) {
                status = field.name;
                statusOptionId = field.optionId;
            }
            if (field.field.id === fields.status_qa_board.id) {
                statusQaBoard = field.name;
                statusQaBoardOptionId = field.optionId;
            }
        }

        core.info(
            `Item #${item.content?.number} | status=${status} (${statusOptionId}) | qaBoard=${statusQaBoard} (${statusQaBoardOptionId})`
        );

        return {
            itemId: item.id,
            issueNumber: item.content?.number,
            status,
            statusOptionId,
            statusQaBoard,
            statusQaBoardOptionId
        };
    });
}
export default async function sync({github, context, core}) {

    core.startGroup("QA board sync");

    const PROJECT_ID = config.project.id;
    const QA_STATUS_ID = config.project.fields.status.options.qa.id;
    const QA_BOARD_FIELD = config.project.fields.status_qa_board.id;
    const TODO_OPTION = config.project.fields.status_qa_board.options.todo.id;

    core.info(`Project ID: ${PROJECT_ID}`);
    core.info(`QA status optionId: ${QA_STATUS_ID}`);
    core.info(`QA board TODO optionId: ${TODO_OPTION}`);

    const items = await getProjectItemsByStatus(
        github,
        PROJECT_ID,
        config.project.fields,
        core
    );

    core.info(`Total items received: ${items.length}`);

    const itemsToUpdate = items.filter(item =>
        item.statusOptionId === QA_STATUS_ID &&
        !item.statusQaBoardOptionId
    );

    core.info(`Items matching rule (status=QA and qaBoard empty): ${itemsToUpdate.length}`);

    for (const item of itemsToUpdate) {

        core.info(`Updating item issue #${item.issueNumber}`);

        try {

            await updateSingleSelectField(github, {
                projectId: PROJECT_ID,
                itemId: item.itemId,
                fieldId: QA_BOARD_FIELD,
                optionId: TODO_OPTION
            });

            core.notice(`Updated QA board for issue #${item.issueNumber}`);

        } catch (err) {

            core.error(`Failed to update issue #${item.issueNumber}: ${err.message}`);

        }
    }

    core.endGroup();
}
*/

/*export async function getProjectItemsByStatus(github, projectId, fields, core) {
    core.info("Fetching project items via GraphQL...");
    const query = `
    query ($projectId: ID!) {
      node(id: $projectId) {
        ... on ProjectV2 {
          items(first: 100) {
            nodes {
              id
              content {
                ... on Issue {
                  number
                  title
                }
              }

              fieldValues(first: 20) {
                nodes {
                  __typename
                  ... on ProjectV2ItemFieldSingleSelectValue {
                    field {
                      ... on ProjectV2SingleSelectField {
                        id
                        name
                      }
                    }
                    optionId
                    name
                  }

                }
              }

            }
          }
        }
      }
    }`;

    const res = await github.graphql(query, { projectId });
    const items = res?.node?.items?.nodes ?? [];
    core.info(`Total project items fetched: ${items.length}`);
    const result = [];
    for (const item of items) {
        const issueNumber = item?.content?.number ?? null;
        if (!issueNumber) {
            core.info(`Draft or non-issue item detected: ${item.id}`);
        }

        let status = null;
        let statusOptionId = null;
        let statusQaBoard = null;
        let statusQaBoardOptionId = null;

        const fieldsValues = item?.fieldValues?.nodes ?? [];

        for (const field of fieldsValues) {

            if (!field?.field?.id) {
                core.info(`Item #${issueNumber} has field without field.id`);
                continue;
            }

            if (field.field.id === fields.status.id) {
                status = field.name;
                statusOptionId = field.optionId;
            }

            if (field.field.id === fields.status_qa_board.id) {
                statusQaBoard = field.name;
                statusQaBoardOptionId = field.optionId;
            }
        }

        core.info(
            `Item #${issueNumber} | status=${status} (${statusOptionId}) | qaBoard=${statusQaBoard} (${statusQaBoardOptionId})`
        );

        result.push({
            itemId: item.id,
            issueNumber,
            status,
            statusOptionId,
            statusQaBoard,
            statusQaBoardOptionId
        });
    }

    return result;
}*/

export async function getProjectItems(github, projectId, core) {

    core.info("Fetching project items via GraphQL...");

    const query = `
    query ($projectId: ID!) {
      node(id: $projectId) {
        ... on ProjectV2 {
          items(first: 100) {
            nodes {
              id
              content {
                ... on Issue {
                  id
                  number
                  title
                }
              }
              fieldValues(first: 20) {
                nodes {
                  ... on ProjectV2ItemFieldSingleSelectValue {
                    field {
                      ... on ProjectV2SingleSelectField {
                        id
                        name
                      }
                    }
                    optionId
                    name
                  }
                }
              }
            }
          }
        }
      }
    }`;

    const res = await github.graphql(query, { projectId });

    const items = res.node.items.nodes;

    core.info(`Total project items fetched: ${items.length}`);

    return items.map(item => {

        const fields = {};

        for (const fieldValue of item.fieldValues.nodes) {

            if (!fieldValue?.field) continue;

            fields[fieldValue.field.name] = {
                fieldId: fieldValue.field.id,
                optionId: fieldValue.optionId,
                value: fieldValue.name
            };
        }

        const normalized = {
            itemId: item.id,
            issue: item.content
                ? {
                    id: item.content.id,
                    number: item.content.number,
                    title: item.content.title
                }
                : null,
            fields
        };

        core.info(JSON.stringify(normalized, null, 2));

        return normalized;
    });
}
export default async function sync({github, context, core}) {

    // const issue = await github.rest.issues.get({
    //     owner: context.repo.owner,
    //     repo:context.repo.repo,
    //     issue_number: 11
    // });
    //
    // console.log(JSON.stringify(issue.data, null, 2));

    core.startGroup("QA board sync");

    const PROJECT_ID = config.project.id;
    const QA_STATUS_ID = config.project.fields.status.options.qa.id;

    const QA_BOARD_FIELD = config.project.fields.status_qa_board.id;
    const TODO_OPTION = config.project.fields.status_qa_board.options.todo.id;

    core.info(`Project ID: ${PROJECT_ID}`);
    core.info(`QA status optionId: ${QA_STATUS_ID}`);
    core.info(`QA board TODO optionId: ${TODO_OPTION}`);

    const items = await getProjectItems(
        github,
        PROJECT_ID,
        core
    );

    core.info(`Total items received: ${items.length}`);

    const itemsToUpdate = items.filter(item => {
        const status = item.fields["Status"];
        const qaBoard = item.fields["QA Board"];

        return (
            status?.optionId === QA_STATUS_ID &&
            !qaBoard?.optionId
        );
    });

    core.info(`Items matching rule (status=QA and qaBoard empty): ${itemsToUpdate.length}`);

    for (const item of itemsToUpdate) {

        core.info(`Updating item issue #${item.issueNumber}`);

        try {

            await updateSingleSelectField(github, {
                projectId: PROJECT_ID,
                itemId: item.itemId,
                fieldId: QA_BOARD_FIELD,
                optionId: TODO_OPTION
            });

            core.notice(`Updated QA board for issue #${item.issueNumber}`);

        } catch (err) {

            core.error(`Failed to update issue #${item.issueNumber}: ${err.message}`);
        }
    }

    core.endGroup();
}