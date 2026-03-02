// projectV2/src/services/getLinkedIssues.mjs
import { getClosingIssuesReferences } from "../api/graphql/getClosingIssuesReferences.mjs";

/**
 * Fetches issues linked to a pull request via closing keywords
 * and returns normalized references with project relations.
 *
 * @async
 * @function getLinkedIssuesRefs
 *
 * @param {import("@octokit/core").Octokit} github
 * Octokit instance used for GitHub API requests.
 *
 * @param {Object} params
 * @param {string} params.owner - Repository owner login.
 * @param {string} params.repo - Repository name.
 * @param {number} params.prNumber - Pull request number.
 *
 * @returns {Promise<Array<{
 *   issuesId: string,
 *   owner: string,
 *   repo: string,
 *   number: number,
 *   projects: Array<{
 *     itemId: string,
 *     projectId: (string|undefined)
 *   }>
 * }>>}
 *
 * @description
 * - Retrieves closing issue references for a PR.
 * - Filters out invalid/null entries.
 * - Normalizes repository + project item information.
 * - Excludes issues missing owner, repo, or number.
 */
export async function getLinkedIssuesRefs(github, {owner, repo, prNumber}) {
    const rawNodes = await getClosingIssuesReferences(github, {owner, repo, prNumber});
    return (rawNodes ?? [])
        .filter(Boolean)
        .map(issue => ({
            issuesId: issue.id, // Issue Node ID (I_...)
            owner: issue.repository?.owner?.login,
            repo: issue.repository?.name,
            number: issue.number,
            // Масив зв'язків: Item + Project
            projects: (issue.projectItems?.nodes ?? []).map(item => ({
                itemId: item.id,        // PVTI_...
                projectId: item.project?.id // PVT_...
            }))
        }))
        .filter(i => i.owner && i.repo && i.number);
}