//projectV2/services/getIssuesProjectItems.mjs
/**
 * Fetch meta details for given issues.
 *
 * @param {import("@octokit/core").Octokit} github
 * @param {Array<{ owner: string, repo: string, number: number }>} issues
 * @returns {Promise<Array<{
 *   id: string,
 *   owner: string,
 *   repo: string,
 *   number: number,
 *   title: string,
 *   url: string,
 *   state: string
 * }>>}
 */
export async function getIssuesMetaDetails(github, issues) {
    if (!issues?.length) return [];

    const queryParts = issues.map((issue, i) => `
      issue_${i}: repository(owner: "${issue.owner}", name: "${issue.repo}") {
        issue(number: ${issue.number}) {
          id
          number
          title
          url
          state
        }
      }
    `).join("\n");

    const query = `query { ${queryParts} }`;
    const data = await github.graphql(query);

    return Object.values(data)
        .map((repoData, index) => {
            const issue = repoData?.issue;
            if (!issue) return null;

            return {
                id: issue.id,
                owner: issues[index].owner,
                repo: issues[index].repo,
                number: issue.number,
                title: issue.title,
                url: issue.url,
                state: issue.state,
                la

            };
        })
        .filter(Boolean);
}