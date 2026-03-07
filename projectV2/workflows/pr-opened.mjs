//projectV2/workflows/pr-opened.mjs

import {logGroup} from "../utils/logger.mjs";
import {parseIssuesFromBody} from "../helpers/parseLinkedIssues.mjs";
import {getClosingIssuesReferences} from "../api/graphql/getClosingIssuesReferences.mjs";
import {syncPRBody} from "../services/syncPRBody6.mjs";
import {updateSingleSelectField} from "../api/graphql/updateSingleSelectField.mjs";
import {config} from "../config/project-org-dev-board.mjs";
import {getIssuesProjectItems} from "../services/getIssuesProjectItems.mjs";
import {syncBranchValidation} from "../services/syncBranchValidation.mjs";

export default async function prOpened({github, context, core, githubToken}) {
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
            headRef: null,
            baseRef: null,
        };

        // отримуємо повний PR
        const {data: currentPr} = await github.rest.pulls.get({
            owner: ctx.owner,
            repo: ctx.repo,
            pull_number: ctx.prNumber,
        });

        console.log(currentPr.commits);

        ctx.prData = currentPr;
        ctx.prBody = currentPr.body ?? "";
        ctx.headRef = currentPr.head.ref
        ctx.baseRef = currentPr.base.ref

        console.log("PR title:", ctx.prData.title);
        console.log("PR body:", ctx.prData.body);

        // отримуємо коміти PR
        const commits = await github.paginate(github.rest.pulls.listCommits,
            {
                owner: ctx.owner,
                repo: ctx.repo,
                pull_number: ctx.prNumber,
                per_page: 100,
            }
        );

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

        // const commitLinkedIssues = commits.flatMap(c =>
        //     parseIssuesFromBody(c.commit.message)
        // );

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
                owner: issue.repository?.owner?.login,
                repo: issue.repository?.name,
                number: issue.number,
            }))
            .filter(i => i.owner && i.repo && i.number); // видаляємо некоректні
        core.info(`Found ${closingIssues.length} closing issue(s) via GraphQL.`);
        console.log("closingIssues:", closingIssues);

// ----------------------------------------------------
// 1️⃣ Об'єднуємо БЕЗ втрати джерел
// ----------------------------------------------------

        const issueRegistry = new Map();

        function registerIssues(issues, source) {
            for (const issue of issues) {
                const key = `${issue.owner}/${issue.repo}#${issue.number}`;

                if (!issueRegistry.has(key)) {
                    issueRegistry.set(key, {
                        owner: issue.owner,
                        repo: issue.repo,
                        number: issue.number,
                        sources: new Set([source]),
                    });
                } else {
                    issueRegistry.get(key).sources.add(source);
                }
            }
        }

        registerIssues(bodyLinkedIssues, "body");
        registerIssues(commitLinkedIssues, "commit");
        registerIssues(closingIssues, "graphql");
        console.log("issueRegistry", issueRegistry)

        const uniqueIssues = Array.from(issueRegistry.values());
        console.log("Issue registry (with sources):", uniqueIssues);

        core.notice("Fetch full issue data via REST");
        const enrichedIssues = [];
        for (const issue of uniqueIssues) {
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
                    sources: issue.sources, // ← Set
                    title: data.title,
                    url: data.html_url,
                    labels: data.labels.map(l => l.name) // <- додаємо назви лейблів
                });

                core.info(`✔ ${issue.owner}/${issue.repo}#${issue.number}`);
            } catch (err) {
                core.warning(
                    `Cannot access ${issue.owner}/${issue.repo}#${issue.number}`
                );
            }
        }
        console.log("Enriched issues with sources:", enrichedIssues);

        core.notice("syncPRBody");
        await syncPRBody({github, context, core, githubToken}, enrichedIssues, currentPr);

        console.log('Head branch:', ctx.headRef);   // Назва гілки з якої PR
        console.log('Base branch:', ctx.baseRef);   // Назва base branch

        // Синхронізація валідації гілок
        const validation = await syncBranchValidation(
            {github, context, core}, ctx.baseRef, enrichedIssues, currentPr
        );

        if (validation.hasError) {
            return; // Зупиняємося, якщо валідація не пройшла
        }

        const projectItems = await getIssuesProjectItems(github, uniqueIssues);
        console.log("Projects:", projectItems);

        const project = config.project;
        const PROJECT_ID = project.id;
        const DEV_STATUS_FIELD_ID = project.fields.status.id;
        const REVIEW_OPTION = project.fields.status.options.review;

        // Відбираємо тільки ті елементи, які належать до нашого проекту
        const itemsToUpdate = projectItems.filter(item => item.projectId === PROJECT_ID);
        console.log("itemsToUpdate", itemsToUpdate);

        const errors = [];

        for (const item of itemsToUpdate) {
            await logGroup(core, `Issue #${item.issueNumber}`, async () => {
                try {
                    await updateSingleSelectField(github, {
                        projectId: PROJECT_ID,
                        itemId: item.itemId,
                        fieldId: DEV_STATUS_FIELD_ID,
                        optionId: REVIEW_OPTION.id
                    });
                    core.info(`✅ Item "${item.itemId}" Issues "${item.issueNumber}" updated "DEV Board Status" to "${REVIEW_OPTION.name}"`);
                } catch (err) {
                    const msg = `❌ Failed for item ${item.itemId}: ${err.message}`;
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

// // ----------------------------------------------------
// // 2️⃣ ВАЛІДАЦІЯ: Гілка vs Лейбли
// // ----------------------------------------------------
// await logGroup(core, "Validating branch vs issue labels", async () => {
//     core.notice("Validating branch vs issue labels");
//
//     const isPrereleaseBranch = ctx.baseRef === 'prerelease';
//     let hasWarning = false;
//     let hasError = false;
//     const messages = [];
//
//     for (const issue of enrichedIssues) {
//         const hasPrereleaseLabel = issue.labels.includes('Prerelease');
//
//         // 🔴 ERROR: merge в prerelease без Prerelease label
//         if (isPrereleaseBranch && !hasPrereleaseLabel) {
//             hasError = true;
//             messages.push(
//                 `❌ Issue #${issue.number} is NOT marked as 'Prerelease'. You cannot merge it into 'prerelease' branch.`
//             );
//         }
//
//         // 🔶 WARNING: Prerelease label але не prerelease branch
//         if (!isPrereleaseBranch && hasPrereleaseLabel) {
//             hasWarning = true;
//             messages.push(
//                 `⚠️ Issue #${issue.number} has 'Prerelease' label. You cannot merge it into '${ctx.baseRef}'. Target branch must be 'prerelease'.`
//             );
//         }
//     }
//
//     // Якщо є хоча б одне повідомлення (Warning або Error)
//     if (messages.length > 0) {
//         const body = messages.join("\n\n");
//
//         // Публікуємо коментар в PR
//         await github.rest.issues.createComment({
//             owner: ctx.owner,
//             repo: ctx.repo,
//             issue_number: ctx.prNumber,
//             body: `### 🔎 Branch / Label Validation\n\n${body}`
//         });
//
//         if (hasError) {
//             core.setFailed("Validation failed: blocking issues found.");
//             return; // ПЕРЕРИВАЄМО, бо це критична помилка
//         }
//
//         if (hasWarning) {
//             core.warning("Validation warnings found, but proceeding with automation.");
//             // НЕ робимо return, щоб скрипт оновив статус у проекті
//         }
//     }
//     core.info("✅ Validation passed (or only warnings found). Moving to automation...");
// });
//
//
// for (const issue of enrichedIssues) {
//     const labels = issue.labels || [];
//     const hasStage = labels.includes('Stage');
//     const hasPrerelease = labels.includes('Prerelease');
//
//     // -------------------------------
//     // 1️⃣ М'яка перевірка - додати label якщо немає
//     // -------------------------------
//     if (!hasStage && !hasPrerelease) {
//         let missingLabel = null;
//         if (ctx.baseRef === 'develop') {
//             missingLabel = 'Stage';
//         } else if (ctx.baseRef === 'prerelease') {
//             missingLabel = 'Prerelease';
//         }
//
//         if (missingLabel) {
//             try {
//                 await github.rest.issues.addLabels({
//                     owner: issue.owner,
//                     repo: issue.repo,
//                     issue_number: issue.number,
//                     labels: [missingLabel]
//                 });
//                 console.log(`🟢 Issue #${issue.number}: додано label "${missingLabel}" (м’яка перевірка)`);
//             } catch (err) {
//                 console.error(`❌ Issue #${issue.number}: не вдалося додати label "${missingLabel}": ${err.message}`);
//             }
//         }
//     } else {
//         console.log(`ℹ️ Issue #${issue.number}: label вже існує, пропускаємо м’яку перевірку`);
//     }
// }


// // -------------------------------
// // 2️⃣ ВАЛІДАЦІЯ: Гілка vs Лейбли
// // -------------------------------
// core.notice("Validating branch vs issue labels");
// const isPrereleaseBranch = ctx.baseRef === 'prerelease';
// const errorMsg = [];
//
// for (const issue of enrichedIssues) {
//     const hasPrereleaseLabel = issue.labels.includes('Prerelease');
//     // Логіка 1: Якщо є лейбла Prerelease -> можна тільки в гілку prerelease
//     if (hasPrereleaseLabel && !isPrereleaseBranch) {
//         core.warning(`⚠️ Issue #${issue.number} has 'Prerelease' label. You cannot merge it into '${ctx.baseRef}'. Target branch must be 'prerelease'.`);
//     }
//     // Логіка 2: Якщо лейбли немає або вона 'Stage' -> будь-куди, КРІМ prerelease
//     if (!hasPrereleaseLabel && isPrereleaseBranch) {
//         core.setFailed(`❌ Issue #${issue.number} is NOT marked as 'Prerelease'. You cannot merge it into 'prerelease' branch.`);
//     }
// }
// if (errors.length > 0) {
//     const errorMessage = errors.join("\n");
//     core.setFailed("Strict Merge Policy Violation:\n" + errorMessage);
//
//     // Опціонально: пишемо коментар прямо в PR, щоб розробник не йшов у логи
//     await github.rest.issues.createComment({
//         owner: ctx.owner,
//         repo: ctx.repo,
//         issue_number: ctx.prNumber,
//         body: `### ⚠️ Помилка валідації гілок\n${errorMessage}`
//     });
//     return; // Зупиняємо скрипт, не оновлюємо статуси в проектах
// }
//
// core.info("✅ Validation passed: Issue labels match target branch.");