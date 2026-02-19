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

    await github.graphql(mutation, {
        projectId,
        itemId,
        fieldId,
        optionId
    });
}
