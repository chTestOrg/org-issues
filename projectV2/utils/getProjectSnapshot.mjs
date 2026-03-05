import {config} from "../config/project-org-dev-board.mjs";

// export default async function getProjectSnapshot({ github, context, core }) {
//
//
//     let cursor = null;
//     let allItems = [];
//     core.startGroup("Fetching project items");
//     while (true) {
//         const query = `
//         query($projectId: ID!, $cursor: String) {
//           node(id: $projectId) {
//             ... on ProjectV2 {
//               items(first: 100, after: $cursor) {
//                 nodes {
//                   id
//                   content {
//                     ... on Issue {
//                       number
//                       title
//                       repository {
//                         name
//                         owner { login }
//                       }
//                     }
//                   }
//                   fieldValues(first: 20) {
//                     nodes {
//                       __typename
//                       ... on ProjectV2ItemFieldSingleSelectValue {
//                         name
//                         optionId
//                         field {
//                           ... on ProjectV2FieldCommon {
//                             id
//                             name
//                           }
//                         }
//                       }
//                       ... on ProjectV2ItemFieldTextValue {
//                         text
//                         field {
//                           ... on ProjectV2FieldCommon {
//                             id
//                             name
//                           }
//                         }
//                       }
//                     }
//                   }
//                 }
//                 pageInfo {
//                   hasNextPage
//                   endCursor
//                 }
//               }
//             }
//           }
//         }`;
//
//         const res = await github.graphql(query, {
//             projectId: PROJECT_ID,
//             cursor
//         });
//         const page = res.node.items;
//         allItems.push(...page.nodes);
//         core.info(`Fetched: ${allItems.length}`);
//         if (!page.pageInfo.hasNextPage) break;
//         cursor = page.pageInfo.endCursor;
//     }
//     core.endGroup();
//
//     const registry = {};
//     for (const item of allItems) {
//         if (!item.content) continue;
//         const issue = item.content;
//         const fields = {};
//         for (const f of item.fieldValues.nodes) {
//             const fieldName = f.field?.name;
//             if (!fieldName) continue;
//             if (f.__typename === "ProjectV2ItemFieldSingleSelectValue") {
//                 fields[fieldName] = {
//                     id: f.field.id,
//                     optionId: f.optionId,
//                     value: f.name
//                 };
//             }
//             if (f.__typename === "ProjectV2ItemFieldTextValue") {
//                 fields[fieldName] = {
//                     id: f.field.id,
//                     value: f.text
//                 };
//             }
//         }
//         const issueUrl = `https://github.com/${issue.repository.owner.login}/${issue.repository.name}/issues/${issue.number}`;
//         registry[issueUrl] = {
//             issueNumber: issue.number,
//             title: issue.title,
//             owner: issue.repository.owner.login,
//             repo: issue.repository.name,
//             itemId: item.id,
//             projectId: PROJECT_ID,
//             fields
//         };
//     }
//
//     core.info(`Total registry items: ${Object.keys(registry).length}`);
//     console.log(JSON.stringify(registry, null, 2));
//     return registry;
// }

export default async function getProjectSnapshot({github, context, core}) {
    const PROJECT_ID = config.project.id;

    if (!PROJECT_ID) {
        core.setFailed("PROJECT_ID env variable is missing");
        return;
    }

    let cursor = null;
    let allItems = [];

    core.startGroup("Fetching project items");
    while (true) {

        const query = `
        query($projectId: ID!, $cursor: String) {
          node(id: $projectId) {
            ... on ProjectV2 {
              items(first: 100, after: $cursor) {
                nodes {
                  id
                  content {
                    __typename
                    ... on Issue {
                      number
                      title
                      repository {
                        name
                        owner { login }
                      }
                    }
                  }
                  fieldValues(first: 20) {
                    nodes {
                      __typename

                      ... on ProjectV2ItemFieldSingleSelectValue {
                        name
                        optionId
                        field {
                          ... on ProjectV2FieldCommon {
                            id
                            name
                          }
                        }
                      }

                      ... on ProjectV2ItemFieldTextValue {
                        text
                        field {
                          ... on ProjectV2FieldCommon {
                            id
                            name
                          }
                        }
                      }
                    }
                  }
                }

                pageInfo {
                  hasNextPage
                  endCursor
                }

              }
            }
          }
        }`;

        const res = await github.graphql(query, {
            projectId: PROJECT_ID,
            cursor
        });

        const page = res.node.items;
        const nodes = page.nodes ?? [];
        allItems.push(...nodes);
        core.info(`Fetched ${nodes.length} items (total: ${allItems.length})`);
        if (!page.pageInfo.hasNextPage) break;
        cursor = page.pageInfo.endCursor;
    }
    core.endGroup();

    const registry = {};
    for (const item of allItems) {
        const issue = item.content;
        // if (!issue) continue;
        if (!issue || issue.__typename !== "Issue") continue;
        const fields = {};
        for (const f of item.fieldValues?.nodes ?? []) {
            const fieldName = f.field?.name;
            if (!fieldName) continue;
            if (f.__typename === "ProjectV2ItemFieldSingleSelectValue") {
                fields[fieldName] = {
                    id: f.field.id,
                    optionId: f.optionId,
                    value: f.name
                };
            }

            if (f.__typename === "ProjectV2ItemFieldTextValue") {
                fields[fieldName] = {
                    id: f.field.id,
                    value: f.text
                };
            }
        }

        const issueUrl =
            `https://github.com/${issue.repository.owner.login}/${issue.repository.name}/issues/${issue.number}`;

        registry[issueUrl] = {
            issueNumber: issue.number,
            title: issue.title,
            owner: issue.repository.owner.login,
            repo: issue.repository.name,
            itemId: item.id,
            projectId: PROJECT_ID,
            fields
        };
    }
    core.info(`Registry size: ${Object.keys(registry).length}`);
    core.info(JSON.stringify(registry, null, 2));

    return registry;
}