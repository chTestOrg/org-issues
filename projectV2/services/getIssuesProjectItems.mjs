//projectV2/services/getIssuesProjectItems.mjs
/**
 * Fetch project items for given issues.
 *
 * @param {import("@octokit/core").Octokit} github
 * @param {Array<{ owner: string, repo: string, number: number }>} issues
 * @returns {Promise<Array<{
 *   issueNumber: number,
 *   owner: string,
 *   repo: string,
 *   itemId: string,
 *   projectId: string | undefined
 * }>>}
 */
export async function getIssuesProjectItems(github, issues) {
    if (!issues?.length) return [];

    const queryParts = issues.map((issue, i) => `
      issue_${i}: repository(owner: "${issue.owner}", name: "${issue.repo}") {
        issue(number: ${issue.number}) {
          number
          projectItems(first: 20) {
            nodes {
              id
              project {
                id
              }
            }
          }
        }
      }
    `).join("\n");

    const query = `query { ${queryParts} }`;
    const data = await github.graphql(query);
    const result = [];

    Object.values(data).forEach((repoData, index) => {
        const issue = repoData?.issue;
        if (!issue) return;

        const base = issues[index];

        (issue.projectItems?.nodes ?? []).forEach(item => {
            result.push({
                issueNumber: issue.number,
                owner: base.owner,
                repo: base.repo,
                itemId: item.id,
                projectId: item.project?.id,
            });
        });
    });

    return result;
}