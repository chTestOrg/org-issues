import {config} from '../config/project-org-dev-board.mjs';
import {getClosingIssuesReferences} from '../api-graphql/getClosingIssuesReferences.mjs';
import {updateSingleSelectField} from '../api-graphql/updateSingleSelectField.mjs';
import {logGroup} from '../utils/logger.mjs';
import {parseLinkedIssues} from "../helpers/parseLinkedIssues.mjs";

export default async function projectPrOpened({github, context, core}) {
    try {
        core.info("=== projectPrOpened START ===");

        // Подивитися тип події
        core.info(`Event name: ${context.eventName}`);

        if (!context.payload.pull_request) {
            core.notice("Not a PR event. Skipping.");
            return;
        }

        // Лог payload (обережно, може бути великий)
        core.info("Full context.payload:");
        core.info(JSON.stringify(context.payload, null, 2));

        const owner = context.repo.owner;
        const repo = context.repo.repo;
        const pull_number = context.payload.pull_request.number;

        core.info(`Owner: ${owner}`);
        core.info(`Repo: ${repo}`);
        core.info(`PR number: ${pull_number}`);

        const project = config.project;

        const PROJECT_ID = project.id;
        const DEV_STATUS_FIELD_ID = project.fields.status.id;
        const DEV_STATUS_FIELD_OPTION = project.fields.status.options;

        core.info("Project config:");
        core.info(JSON.stringify(project, null, 2));

        const {data: currentPr} = await github.rest.pulls.get({
            owner,
            repo,
            pull_number,
        });

        core.info("Fetched PR data:");
        core.info(JSON.stringify(currentPr, null, 2));

        const prBody = currentPr.body ?? "";

        core.info("PR body:");
        core.info(prBody);

        await logGroup(core, "Fetch closing issues", async () => {

            const issuesLinked = parseLinkedIssues(prBody);
            core.info("Parsed issuesLinked:");
            core.info(JSON.stringify(issuesLinked, null, 2));

            const issuesReferences = await getClosingIssuesReferences(
                github,
                {owner, repo, pull_number}
            );

            core.info("GraphQL issuesReferences:");
            core.info(JSON.stringify(issuesReferences, null, 2));

            if (issuesLinked.length === 0 || issuesReferences.length === 0) {
                core.notice("No linked issues found.");
                return;
            }

            core.info(`Found ${issuesLinked.length} issue(s) from body.`);
            core.info(`Found ${issuesReferences.length} issue(s) from GraphQL.`);
        });

        core.info("=== projectPrOpened END ===");

    } catch (error) {
        core.error("Error in projectPrOpened:");
        core.error(error);
        core.setFailed(error.message);
    }
}