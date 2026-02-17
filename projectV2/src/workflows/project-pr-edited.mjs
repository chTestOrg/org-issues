import {config} from "../../config/project-org-dev-board.mjs";
import {logGroup} from "../utils/logger.mjs";
import {getClosingIssuesReferences} from "../api/getClosingIssuesReferences.mjs";
import {updateSingleSelectField} from "../api/updateSingleSelectField.mjs";
import prVerifyLinkedIssues from "./temp/links.mjs";
//import prVerifyLinkedIssues from "./pr-verify-linked-issues.mjs";

export default async function projectPrOpened({ github, context, core }) {
    try {
        if (!context.payload.pull_request) {
            core.notice("Not a PR event. Skipping.");
            return;
        }

        await prVerifyLinkedIssues({github, context, core});

    } catch (err) {
        core.setFailed(`Fatal error: ${err.message}`);
    }
};
