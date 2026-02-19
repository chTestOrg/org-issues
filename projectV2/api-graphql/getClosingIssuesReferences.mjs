export async function getClosingIssuesReferences(github, {owner, repo, prNumber}) {
    const query = `
        query($owner: String!, $repo: String!, $prNumber: Int!) {
          repository(owner: $owner, name: $repo) {
            pullRequest(number: $prNumber) {
              closingIssuesReferences(first: 50) {
                nodes {
                  id
                  number
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

    try {
        const res = await github.graphql(query, {owner, repo, prNumber});

        if (!res.repository?.pullRequest) {
            throw new Error(`Pull Request #${prNumber} not found in ${owner}/${repo}`);
        }
        return res.repository.pullRequest.closingIssuesReferences.nodes || [];

    } catch (error) {
        throw new Error(
            `GraphQL Fetch Error: Could not get closing issues for PR #${prNumber}. ` +
            `Check permissions or repository path (${owner}/${repo}). Original error: ${error.message}`
        );
    }
}