import { config }                  from "../config/project-org-dev-board.mjs";
import { getFilteredProjectItems } from "../getFilteredProjectItems.mjs";
import { updateSingleSelectField } from "../api/graphql/updateSingleSelectField.mjs";
import { setTextField, clearSingleSelectField, closeIssue } from "../api/graphql/mutations.mjs";
import { logGroup }                from "../utils/logger.mjs";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getField(item, fieldId) {
    return item.fieldValues?.nodes?.find(f => f.field?.id === fieldId);
}

function filterBySource(items, source) {
    return items.filter(item =>
        getField(item, fields.source.id)?.name === source
    );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export default async function releaseFlow({ github, core, filter, source, releaseVersion, releaseDate, dryRun = false }) {
    // Validate inputs
    if (!releaseVersion) { core.setFailed("releaseVersion is required"); return; }
    if (!releaseDate)    { core.setFailed("releaseDate is required");    return; }
    if (!source)         { core.setFailed("source is required");         return; }

    // In dry run mode — log the intended mutation instead of executing it
    async function mutate(label, fn) {
        if (dryRun) {
            core.info(`    [dry-run] ${label}`);
            return;
        }
        return fn();
    }

    const { id: projectId, fields } = config.project;

    core.info("=".repeat(60));
    core.info("Release Flow");
    core.info(`  filter  : ${filter}`);
    core.info(`  source  : ${source}`);
    core.info(`  version : ${releaseVersion}`);
    core.info(`  date    : ${releaseDate}`);
    core.info(`  project : ${projectId}`);
    core.info(`  dry run : ${dryRun ? "YES — no mutations will be made" : "no"}`);
    core.info("=".repeat(60));

    // -------------------------------------------------------------------------
    // Fetch & filter
    // -------------------------------------------------------------------------

    const rawItems = await logGroup(core, "Fetching project items", () =>
        getFilteredProjectItems(github, projectId, filter)
    );

    const withContent = rawItems.filter(item => item.content != null);
    const items       = filterBySource(withContent, source);

    core.info(`  ${rawItems.length} fetched → ${withContent.length} with issue content → ${items.length} matching source "${source}"\n`);

    if (!items.length) {
        core.info("Nothing to process. Exiting.");
        return;
    }

    // -------------------------------------------------------------------------
    // Steps
    // -------------------------------------------------------------------------

    async function stepSetReleaseVersion(item) {
        const current = getField(item, fields.release_version.id)?.text;
        if (current) return `[skip] release_version already "${current}"`;

        await mutate(`setTextField release_version → "${releaseVersion}"`, () =>
            setTextField(github, { projectId, itemId: item.id, fieldId: fields.release_version.id, text: releaseVersion })
        );
        return `[done] release_version → "${releaseVersion}"`;
    }

    async function stepSetReleaseDate(item) {
        const current = getField(item, fields.release_date.id)?.date;
        if (current) return `[skip] release_date already "${current}"`;

        await mutate(`setTextField release_date → "${releaseDate}"`, () =>
            setTextField(github, { projectId, itemId: item.id, fieldId: fields.release_date.id, text: releaseDate })
        );
        return `[done] release_date → "${releaseDate}"`;
    }

    async function stepCloseIssue(item) {
        if (item.content.state !== "OPEN") return `[skip] issue already ${item.content.state}`;

        await mutate(`closeIssue #${item.content.number}`, () =>
            closeIssue(github, { issueId: item.content.id })
        );
        return `[done] issue closed`;
    }

    async function stepMoveToDone(item) {
        const { completed, done } = fields.status.options;
        const status = getField(item, fields.status.id)?.name ?? null;

        if (status !== completed.name) return `[skip] status is "${status ?? "—"}", expected "${completed.name}"`;

        await mutate(`updateSingleSelectField status → "${done.name}"`, () =>
            updateSingleSelectField(github, { projectId, itemId: item.id, fieldId: fields.status.id, optionId: done.id })
        );
        return `[done] status "${completed.name}" → "${done.name}"`;
    }

    async function stepClearQaStatus(item) {
        const qaStatus = getField(item, fields.status_qa_board.id)?.name ?? null;
        if (!qaStatus) return `[skip] QA status already empty`;

        await mutate(`clearSingleSelectField status_qa_board (was "${qaStatus}")`, () =>
            clearSingleSelectField(github, { projectId, itemId: item.id, fieldId: fields.status_qa_board.id })
        );
        return `[done] QA status "${qaStatus}" cleared`;
    }

    const steps = [
        stepSetReleaseVersion,
        stepSetReleaseDate,
        stepCloseIssue,
        stepMoveToDone,
        stepClearQaStatus,
    ];

    // -------------------------------------------------------------------------
    // Process items
    // -------------------------------------------------------------------------

    const results = await logGroup(core, `Processing ${items.length} items`, async () => {
        const outcomes = [];

        for (const item of items) {
            const { number, title, state, issueType } = item.content;
            const type = issueType?.name ?? "Other";

            core.info(`\n  #${number} [${type}] [${state}] ${title}`);

            let mutations  = 0;
            let errors     = 0;
            const stepErrors = [];

            for (const step of steps) {
                try {
                    const result = await step(item);
                    core.info(`    ${result}`);
                    if (result.startsWith("[done]")) mutations++;
                } catch (err) {
                    const msg = `${step.name}: ${err.message}`;
                    core.error(`    [error] ${msg}`);
                    stepErrors.push(msg);
                    errors++;
                }
            }

            outcomes.push({ number, title, type, mutations, errors, stepErrors });
        }

        return outcomes;
    });

    // -------------------------------------------------------------------------
    // Summary
    // -------------------------------------------------------------------------

    const succeeded = results.filter(r => r.errors === 0);
    const failed    = results.filter(r => r.errors  > 0);

    const totalMutations = results.reduce((acc, r) => acc + r.mutations, 0);
    const unchanged      = succeeded.filter(r => r.mutations === 0).length;

    core.info("\n" + "=".repeat(60));
    core.info("Summary");
    core.info(`  Items processed  : ${items.length}`);
    core.info(`  Items unchanged  : ${unchanged}`);
    core.info(`  Total mutations  : ${totalMutations}`);
    core.info(`  Failed items     : ${failed.length}`);

    if (succeeded.length) {
        const byType = succeeded.reduce((acc, item) => {
            (acc[item.type] ??= []).push(item);
            return acc;
        }, {});

        core.info("\nProcessed:");
        for (const [type, group] of Object.entries(byType)) {
            core.info(`\n  ${type}:`);
            for (const { number, title } of group) {
                core.info(`    #${number} ${title}`);
            }
        }
    }

    if (failed.length) {
        core.info("\nFailed:");
        for (const { number, title, stepErrors } of failed) {
            core.info(`  #${number} ${title}`);
            for (const err of stepErrors) {
                core.info(`    ↳ ${err}`);
            }
        }
    }

    core.info("\n" + "=".repeat(60));

    if (failed.length > 0) {
        core.setFailed(`Release flow completed with ${failed.length} failed item(s)`);
    }
}