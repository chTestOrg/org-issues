//getLinkedIssuesRefs.mjs
import {getClosingIssuesReferences} from "../api/graphql/getClosingIssuesReferences.mjs";
import {parseIssuesFromBody} from "../helpers/parseLinkedIssues.mjs";

function normalizeClosingIssues(nodes) {
    return nodes.map(issue => ({
        owner: issue.repository.owner.login,
        repo: issue.repository.name,
        number: issue.number
    }));
}

function mergeIssues(bodyIssues, commitIssues, closingIssues) {
    const map = new Map();

    for (const issue of [...bodyIssues, ...commitIssues, ...closingIssues]) {
        const key = `${issue.owner}/${issue.repo}#${issue.number}`;
        map.set(key, issue);
    }
    return Array.from(map.values());
}


export async function getLinkedIssuesRefs(github, prBody, core) {
    core.notice("1⃣ Parse issues from body");
    const bodyIssues = parseIssuesFromBody(cleanBody);
    core.info(`Found ${bodyIssues.length} issue(s) in body.`);


    core.notice("2⃣ Fetch PR commits");
    const {data: commits} = await github.rest.pulls.listCommits({
        owner,
        repo,
        pull_number: prNumber
    });

    core.notice("3⃣ Parse issues from commits msg");
    const commitMessages = commits.map(c => c.commit.message).join("\n");
    const commitIssues = parseIssuesFromBody(commitMessages);
    core.info(`Found ${commitIssues.length} issue(s) in commits.`);


    core.info("4⃣ Fetch closingIssuesReferences");
    const gqlIssues = await getClosingIssuesReferences(github, {owner, repo, prNumber});
    const closingIssues = normalizeClosingIssues(gqlIssues);
    core.info(`Found ${closingIssues.length} closing issue(s) via GraphQL.`);


    core.info("5⃣ Merge unique issues");
    const allIssues = mergeIssues(bodyIssues, commitIssues, closingIssues);
    core.info(`Total unique issues: ${allIssues.length}`);

    return allIssues;
}