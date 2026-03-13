/**
 * Повертає всі items з ProjectV2, які відповідають filter (label:, status:, customfield:, ...)
 * - Пагінація через pageInfo.endCursor
 * - Використовує змінну `filter` (не `query`)
 *
 * @param {object} github - octokit graphql client
 * @param {string} projectId - node id проекту (PVT_...)
 * @param {string} filter - рядок фільтрації, як у UI (наприклад: 'label:Prerelease status:Completed')
 * @param {number} pageSize - items per page (max 100)
 */
export async function getFilteredProjectItems(github, projectId, filter, pageSize = 100) {
    const query = `
    query($projectId: ID!, $filter: String!, $after: String, $pageSize: Int!) {
      node(id: $projectId) {
        ... on ProjectV2 {
          items(first: $pageSize, after: $after, query: $filter) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              id
              content {
                ... on Issue {
                  id
                  number
                  title
                  repository { name owner { login } }
                  labels(first: 10) { nodes { id name } }
                }
              }
              fieldValues(first: 30) {
                nodes {
                  ... on ProjectV2ItemFieldSingleSelectValue {
                    optionId
                    name
                    field { ... on ProjectV2SingleSelectField { id name } }
                  }
                  ... on ProjectV2ItemFieldTextValue {
                    text
                    field { ... on ProjectV2FieldCommon { id name } }
                  }
                  ... on ProjectV2ItemFieldNumberValue {
                    number
                    field { ... on ProjectV2FieldCommon { id name } }
                  }
                  ... on ProjectV2ItemFieldDateValue {
                    date
                    field { ... on ProjectV2FieldCommon { id name } }
                  }
                  ... on ProjectV2ItemFieldIterationValue {
                    iterationId
                    field { ... on ProjectV2FieldCommon { id name } }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

    let allItems = [];
    let after = null;
    let hasNext = true;

    while (hasNext) {
        const variables = { projectId, filter, after, pageSize };
        const result = await github.graphql(query, variables);

        const page = result?.node?.items;
        if (!page) break;

        allItems.push(...(page.nodes || []));

        hasNext = page.pageInfo.hasNextPage;
        after = page.pageInfo.endCursor;
    }

    return allItems;
}