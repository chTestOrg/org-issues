
export default async function getIssuesTotalCount({github,context, core}) {
    const owner = context.repo.owner;
    const repo = context.repo.repo;

    const query = `
    query($owner: String!, $repo: String!) {
      repository(owner: $owner, name: $repo) {
        issues(states: [CLOSED]) {
          totalCount
        }
      }
    }
  `;
    const data = await github.graphql(query, {
        owner,
        repo,
    });
    const result = data.repository.issues.totalCount;
    console.log(JSON.stringify(result, null, 2));

    return result
}