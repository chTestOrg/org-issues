export async function updateSingleSelectField(github, { projectId, itemId, fieldId, optionId }) {
    const mutation = `
        mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
          updateProjectV2ItemFieldValue(input: {
            projectId: $projectId,
            itemId: $itemId,
            fieldId: $fieldId,
            value: { singleSelectOptionId: $optionId }
          }) {
            projectV2Item { id }
          }
        }
      `;

    try {
        await github.graphql(mutation, {
            projectId,
            itemId,
            fieldId,
            optionId
        });
    } catch (error) {
        throw new Error(
            `GraphQL Update Error: Failed to set option "${optionId}" for field "${fieldId}" on item "${itemId}". ` +
            `Details: ${error.message}`
        );
    }
}