export async function getClosingIssuesReferences(github, { owner, repo, prNumber }) {
    const query = `
        query($owner: String!, $repo: String!, $prNumber: Int!) {
          repository(owner: $owner, name: $repo) {
            pullRequest(number: $prNumber) {
              merged
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

    const res = await github.graphql(query, { owner, repo, prNumber });

    return {
        merged: res.repository.pullRequest.merged,
        issues: res.repository.pullRequest.closingIssuesReferences.nodes || []
    };
}
