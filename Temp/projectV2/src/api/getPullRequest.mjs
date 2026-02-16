export async function getPrBody(github, { owner, repo, prNumber }) {
    const { data } = await github.rest.pulls.get({
        owner,
        repo,
        pull_number: prNumber,
    });

    return {
        body: data.body ?? "",
    };
}

export async function updatePrBody(github, { owner, repo, prNumber, body }) {
    await github.rest.pulls.update({
        owner,
        repo,
        pull_number: prNumber,
        body,
    });
}

export async function getIssueTitle(github, { owner, repo, issueNumber }) {
    const { data } = await github.rest.issues.get({
        owner,
        repo,
        issue_number: issueNumber,
    });

    return data.title;
}
