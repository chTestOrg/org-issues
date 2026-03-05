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

/*export default async function getProjectSnapshot({github, context, core}) {
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
}*/

/*export default async function getAllProjectItems({ github, core }) {
    const PROJECT_ID = config.project.id;

    let allItems = [];
    let hasNextPage = true;
    let afterCursor = null;

    core.info(`Починаю збір елементів проекту: ${PROJECT_ID}`);

    try {
        while (hasNextPage) {
            const query = `
            query($nodeId: ID!, $after: String) {
              node(id: $nodeId) {
                ... on ProjectV2 {
                  items(first: 100, after: $after) {
                    pageInfo {
                      hasNextPage
                      endCursor
                    }
                    nodes {
                      id
                      type
                      createdAt
                      updatedAt
                      # Дані про саму картку (Issue або PR)
                      content {
                        ... on Issue {
                          title
                          number
                          url
                          state
                          repository { name { owner { login } } }
                        }
                        ... on PullRequest {
                          title
                          number
                          url
                          state
                          repository { name { owner { login } } }
                        }
                        ... on DraftIssue {
                          title
                          author { login }
                        }
                      }
                      # Значення кастомних полів (Status, Priority тощо)
                      fieldValues(first: 20) {
                        nodes {
                          __typename
                          ... on ProjectV2ItemFieldSingleSelectValue {
                            name
                            field { ... on ProjectV2FieldCommon { name } }
                          }
                          ... on ProjectV2ItemFieldTextValue {
                            text
                            field { ... on ProjectV2FieldCommon { name } }
                          }
                          ... on ProjectV2ItemFieldNumberValue {
                            number
                            field { ... on ProjectV2FieldCommon { name } }
                          }
                          ... on ProjectV2ItemFieldDateValue {
                            date
                            field { ... on ProjectV2FieldCommon { name } }
                          }
                          ... on ProjectV2ItemFieldIterationValue {
                            title
                            duration
                            startDate
                            field { ... on ProjectV2FieldCommon { name } }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }`;

            const response = await github.graphql(query, {
                nodeId: PROJECT_ID,
                after: afterCursor
            });

            const projectData = response.node.items;
            allItems.push(...projectData.nodes);

            hasNextPage = projectData.pageInfo.hasNextPage;
            afterCursor = projectData.pageInfo.endCursor;

            core.info(`Отримано ${allItems.length} елементів...`);
        }

        core.info("Збір завершено успішно.");
        core.info(JSON.stringify(allItems, null, 2));
        return allItems;

    } catch (error) {
        core.setFailed(`Помилка при читанні проекту: ${error.message}`);
        return [];
    }
}*/

export default async function getAllProjectItems({ github, core }) {
    const PROJECT_ID = "PVT_kwDODFU6284BNtif";

    let allItems = [];
    let hasNextPage = true;
    let afterCursor = null;

    core.info(`🚀 Починаю збір елементів проекту: ${PROJECT_ID}`);

    try {
        while (hasNextPage) {
            const query = `
            query($nodeId: ID!, $after: String) {
              node(id: $nodeId) {
                ... on ProjectV2 {
                  items(first: 100, after: $after) {
                    pageInfo {
                      hasNextPage
                      endCursor
                    }
                    nodes {
                      id
                      type
                      content {
                        ... on Issue {
                          title
                          number
                          url
                          repository {
                            name
                            owner { login }
                          }
                        }
                        ... on PullRequest {
                          title
                          number
                          url
                          repository {
                            name
                            owner { login }
                          }
                        }
                        ... on DraftIssue {
                          title
                          creator { login }
                        }
                      }
                      fieldValues(first: 20) {
                        nodes {
                          __typename
                          ... on ProjectV2ItemFieldSingleSelectValue {
                            name
                            field { ... on ProjectV2FieldCommon { name id } }
                          }
                          ... on ProjectV2ItemFieldTextValue {
                            text
                            field { ... on ProjectV2FieldCommon { name id } }
                          }
                          ... on ProjectV2ItemFieldNumberValue {
                            number
                            field { ... on ProjectV2FieldCommon { name id } }
                          }
                          ... on ProjectV2ItemFieldDateValue {
                            date
                            field { ... on ProjectV2FieldCommon { name id } }
                          }
                          ... on ProjectV2ItemFieldIterationValue {
                            title
                            startDate
                            field { ... on ProjectV2FieldCommon { name id } }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }`;

            const response = await github.graphql(query, {
                nodeId: PROJECT_ID,
                after: afterCursor
            });

            if (!response.node) {
                throw new Error("Проект не знайдено. Перевірте PROJECT_ID та права доступу токена.");
            }

            const projectData = response.node.items;
            allItems.push(...projectData.nodes);

            hasNextPage = projectData.pageInfo.hasNextPage;
            afterCursor = projectData.pageInfo.endCursor;

            core.info(`📥 Отримано ${allItems.length} елементів...`);
        }

        core.info(`✅ Успішно зібрано ${allItems.length} елементів.`);
        core.info(JSON.stringify(allItems, null, 2));
        return allItems;

    } catch (error) {
        core.setFailed(`❌ Помилка при читанні проекту: ${error.message}`);
        return [];
    }
}