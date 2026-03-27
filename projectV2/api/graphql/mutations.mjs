// ---------------------------------------------------------------------------
// Reusable GraphQL mutations for GitHub Projects V2
// ---------------------------------------------------------------------------

export async function setTextField(github, { projectId, itemId, fieldId, text }) {
    return github.graphql(`
        mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $text: String!) {
            updateProjectV2ItemFieldValue(input: {
                projectId: $projectId
                itemId: $itemId
                fieldId: $fieldId
                value: { text: $text }
            }) {
                projectV2Item { id }
            }
        }
    `, { projectId, itemId, fieldId, text });
}

export async function clearSingleSelectField(github, { projectId, itemId, fieldId }) {
    return github.graphql(`
        mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!) {
            updateProjectV2ItemFieldValue(input: {
                projectId: $projectId
                itemId: $itemId
                fieldId: $fieldId
                value: { singleSelectOptionId: null }
            }) {
                projectV2Item { id }
            }
        }
    `, { projectId, itemId, fieldId });
}

export async function closeIssue(github, { issueId }) {
    return github.graphql(`
        mutation($issueId: ID!) {
            closeIssue(input: { issueId: $issueId }) {
                issue { id }
            }
        }
    `, { issueId });
}