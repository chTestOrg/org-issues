//projectV2/workflows/pr-opened.mjs

import {logGroup} from "../utils/logger.mjs";
import {parseIssuesFromBody} from "../helpers/parseLinkedIssues.mjs";
import {getClosingIssuesReferences} from "../api/graphql/getClosingIssuesReferences.mjs";
import {syncPRBody} from "../services/syncPRBody.mjs";
import {getLinkedIssuesRefs} from "../services/getLinkedIssues.mjs";
import {getIssuesProjectItems} from "../services/getIssuesProjectItems.mjs";
import {updateSingleSelectField} from "../api/graphql/updateSingleSelectField.mjs";
import {config} from "../config/project-org-dev-board.mjs";

export default async function prOpened({github, context, core}) {
    await logGroup(core, "Create PR context", async () => {
        const pr = context.payload.pull_request;

        // створюємо базовий контекст
        const ctx = {
            github,
            core,
            owner: context.repo.owner,
            repo: context.repo.repo,
            prNumber: pr.number,
            prData: null,
            prBody: null,
            prCommits: null,
            issuesLinks: [],
        };

        // отримуємо повний PR
        const {data: currentPr} = await github.rest.pulls.get({
            owner: ctx.owner,
            repo: ctx.repo,
            pull_number: ctx.prNumber,
        });

        ctx.prData = currentPr;
        ctx.prBody = currentPr.body ?? [];

        console.log("PR title:", ctx.prData.title);
        console.log("PR body:", ctx.prData.body);

        // отримуємо коміти PR
        const {data: commits} = await github.rest.pulls.listCommits({
            owner: ctx.owner,
            repo: ctx.repo,
            pull_number: ctx.prNumber,
        });

        ctx.prCommits = commits;
        console.log("Number of commits:", commits.length);

        // Шукаємо та парсимо посилання на задачі в prBody
        core.notice("Parse issues from body states");
        const bodyLinkedIssues = parseIssuesFromBody(ctx.prBody);
        core.info(`Found ${bodyLinkedIssues.length} issue(s) in body.`);
        console.log("bodyLinkedIssues:", bodyLinkedIssues);

        // Шукаємо та парсимо посилання на задачі в commits
        core.notice("Parse issues from commits msg");
        const commitMessages = commits.map(c => c.commit.message).join("\n");
        const commitLinkedIssues = parseIssuesFromBody(commitMessages);
        core.info(`Found ${commitLinkedIssues.length} issue(s) in commits.`);
        console.log("commitLinkedIssues:", commitLinkedIssues);


        // Запитуємо зв'язані задачі
        core.info("Fetch closingIssuesReferences (GraphQL)");
        const gqlLinkedIssues = await getClosingIssuesReferences(github, {
            owner: ctx.owner,
            repo: ctx.repo,
            prNumber: ctx.prNumber,
        });

        // плоска нормалізація запиту з GraphQL
        const closingIssues = (gqlLinkedIssues ?? [])
            .filter(Boolean)  // прибираємо null/undefined
            .map(issue => ({
                // issueId: issue.id,
                owner: issue.repository?.owner?.login,
                repo: issue.repository?.name,
                number: issue.number,
                // projectItemIds: issue.projectItems?.nodes?.map(p => p.id) ?? [],
                // projectIds: issue.projectItems?.nodes?.map(p => p.project?.id).filter(Boolean) ?? []
            }))
            .filter(i => i.owner && i.repo && i.number); // видаляємо некоректні
        core.info(`Found ${closingIssues.length} closing issue(s) via GraphQL.`);
        console.log("closingIssues:", closingIssues);


        // Додаємо джерела звідки дістали посилання на issues:
        const bodyIssues = bodyLinkedIssues.map(issue => ({...issue, source: "body"}));
        const commitIssues = commitLinkedIssues.map(issue => ({...issue, source: "commit"}));
        const gqlIssues = closingIssues.map(issue => ({...issue, source: "graphql"}));

        // Об’єднуємо і видаляємо дублікати по owner/repo/number
        const issues = Array.from(
            new Map(
                [...bodyIssues, ...commitIssues, ...gqlIssues].map(
                    issue => [`${issue.owner}/${issue.repo}#${issue.number}`, issue]
                )
            ).values()
        );
        console.log("Unique issues:", issues);

        // Збагачуємо отриманні задачі даними
        core.notice("Fetch full issue data via REST");
        const enrichedIssues = [];

        for (const issue of issues) {
            try {
                const {data} = await github.rest.issues.get({
                    owner: issue.owner,
                    repo: issue.repo,
                    issue_number: issue.number
                });
                enrichedIssues.push({
                    owner: issue.owner,
                    repo: issue.repo,
                    number: issue.number,
                    source: issue.source,
                    title: data.title,
                    url: data.html_url,
                });
                core.info(`✔ ${issue.owner}/${issue.repo}#${issue.number}`);
            } catch (err) {
                core.warning(
                    `Cannot access ${issue.owner}/${issue.repo}#${issue.number}`
                );
            }
        }
        console.log("Enriched issues with source:", enrichedIssues);

        //core.notice("syncPRBody");
        //await syncPRBody({github, context, core}, enrichedIssues, currentPr);


        // Отримуємо ProjectId та ItemId для кожної задачі
        const projectItemsId = await getIssuesProjectItems(github, issues);
        console.log("ProjectId та ItemId", projectItemsId);
        const projectItems = (projectItemsId ?? [])
        // @returns {Promise<Array<{
        // issueNumber: number,
        // owner: string,
        // repo: string,
        // itemId: string,
        // projectId: string | undefined
        // }


        const project = config.project;
        const PROJECT_ID = project.id;
        const DEV_STATUS_FIELD_ID = project.fields.status.id;
        const REVIEW_OPTION = project.fields.status.options.review;

        const items = [];

        for (const issue of projectItems) {
            const issueItems = issue.projectItems?.nodes || [];

            for (const item of issueItems) {
                if (item.project?.id === PROJECT_ID) {
                    items.push({
                        issueNumber: issue.number,
                        itemId: item.id
                    });
                }
            }
        }

        const errors = [];
        for (const {issueNumber, itemId} of items) {
            await logGroup(core, `Issue #${issueNumber}`, async () => {
                try {
                    await updateSingleSelectField(github, {
                        projectId: PROJECT_ID,
                        itemId,
                        fieldId: DEV_STATUS_FIELD_ID,
                        optionId: REVIEW_OPTION.id
                    });
                    core.info(`✅ Item "${itemId}" updated "DEV Board Status" to "${REVIEW_OPTION.name}"`);

                } catch (err) {
                    const msg = `❌ Failed for item ${itemId}: ${err.message}`;
                    core.error(msg);
                    errors.push(msg);
                }
            });
        }
        if (errors.length > 0) {
            core.setFailed(`Completed with ${errors.length} error(s).`);
        } else {
            core.notice("All issues moved to `Review` successfully.");
        }
    });
}