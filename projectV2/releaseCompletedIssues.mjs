//import { config } from "./config/project-7-config.mjs";
import { config } from "./config/project-org-dev-board.mjs";
import { getFilteredProjectItems } from "./getFilteredProjectItems.mjs";
import { updateSingleSelectField } from "./api/graphql/updateSingleSelectField.mjs";
import { logGroup } from "./utils/logger.mjs";

const CLEAR_SINGLE_SELECT = `
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
`;

const SET_TEXT_FIELD = `
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
`;

/**
 * Steps 2–6: Process all Status: Completed + label:Prerelease items
 *
 * Per item:
 *   2. Fetch items with status:Completed + label:Prerelease
 *   3. Set release_version field = releaseVersion input
 *   4. Set Status = Done
 *   5. Clear Status_QA-Board
 *   6. Remove label Prerelease
 */
export default async function releaseCompletedIssues({ github, context, core, releaseVersion }) {
    if (!releaseVersion) {
        core.setFailed("releaseVersion is required");
        return;
    }

    const projectId = config.project.id;
    const filter = "status:Completed -label:WebClipper label:Prerelease";

    core.info(`Release version: ${releaseVersion}`);
    core.info(`Filter: ${filter}`);

    const items = await logGroup(core, "Fetching project items", () =>
        getFilteredProjectItems(github, projectId, filter)
    );

    core.info(`Items to process: ${items.length}`);

    const results = { success: 0, failed: 0, errors: [] };

    for (const item of items) {
        const issue = item.content;
        if (!issue) continue;

        const { id: itemId, number: issueNumber, title, repository } = issue;
        const { name: repo, owner: { login: owner } } = repository;

        await logGroup(core, `#${issueNumber} ${title}`, async () => {
            try {
                // Step 1: set release_version
                core.info(`Setting release_version → ${releaseVersion}`);
                await github.graphql(SET_TEXT_FIELD, {
                    projectId,
                    itemId: item.id,
                    fieldId: config.project.fields.release_version.id,
                    text: releaseVersion,
                });

                // Step 2: Status → Done
                core.info("Setting Status → Done");
                await updateSingleSelectField(github, {
                    projectId,
                    itemId: item.id,
                    fieldId: config.project.fields.status.id,
                    optionId: config.project.fields.status.options.done.id,
                });

                // Step 3: clear QA-Board status
                core.info("Clearing Status_QA-Board");
                await github.graphql(CLEAR_SINGLE_SELECT, {
                    projectId,
                    itemId: item.id,
                    fieldId: config.project.fields.status_qa_board.id,
                });

                // Step 4: remove label Prerelease
                core.info("Removing label: Prerelease");
                await github.rest.issues.removeLabel({
                    owner,
                    repo,
                    issue_number: issueNumber,
                    name: "Prerelease",
                });

                core.info("✔ Done");
                results.success++;

            } catch (err) {
                core.error(`✘ Failed: ${err.message}`);
                results.failed++;
                results.errors.push({ issueNumber, message: err.message });
            }
        });
    }

    await logGroup(core, "Summary", () => {
        core.info(`Total:   ${items.length}`);
        core.info(`Success: ${results.success}`);
        core.info(`Failed:  ${results.failed}`);

        if (results.errors.length) {
            core.warning("Failed items:");
            for (const { issueNumber, message } of results.errors) {
                core.warning(`  #${issueNumber}: ${message}`);
            }
            core.setFailed(`${results.failed} item(s) failed to process`);
        }
    });
}