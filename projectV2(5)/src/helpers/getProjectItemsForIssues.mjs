export function getProjectItemsForIssues(issues, projectId) {
    const result = [];

    for (const issue of issues) {
        const items = issue.projectItems?.nodes || [];

        for (const item of items) {
            if (item.project?.id === projectId) {
                result.push({
                    issueNumber: issue.number,
                    itemId: item.id
                });
            }
        }
    }

    return result;
}
