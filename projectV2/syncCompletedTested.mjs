import { config } from "./config/project-org-dev-board.mjs";
import { getFilteredProjectItems } from "./getFilteredProjectItems.mjs";
import { updateSingleSelectField } from "./api/graphql/updateSingleSelectField.mjs";
import { logGroup } from "./utils/logger.mjs";

/**
 * Step 1: Sync Status: Completed ↔ Status_QA-Board: Tested
 *
 * - Items in Completed but NOT in Tested → set QA-Board = Tested
 * - Items in Tested but NOT in Completed → set Status = Completed
 */
export default async function syncCompletedTested({ github, context, core }) {
    const projectId = config.project.id;

    const [items1, items2] = await logGroup(core, "Fetching project items", async () => {
        const filter1 = "status:Completed -label:WebClipper";
        const filter2 = "status-qa-board:Tested";

        core.info(`Filter 1: ${filter1}`);
        core.info(`Filter 2: ${filter2}`);

        return Promise.all([
            getFilteredProjectItems(github, projectId, filter1),
            getFilteredProjectItems(github, projectId, filter2),
        ]);
    });

    core.info(`Completed items: ${items1.length}`);
    core.info(`Tested items:    ${items2.length}`);

    const toMap = (items) => {
        const map = new Map();
        for (const item of items) {
            if (!item.content) continue;
            map.set(item.content.number, { itemId: item.id, title: item.content.title });
        }
        return map;
    };

    const map1 = toMap(items1); // Completed
    const map2 = toMap(items2); // Tested

    const onlyInCompleted = [...map1.entries()]
        .filter(([num]) => !map2.has(num))
        .map(([number, data]) => ({ number, ...data }));

    const onlyInTested = [...map2.entries()]
        .filter(([num]) => !map1.has(num))
        .map(([number, data]) => ({ number, ...data }));

    await logGroup(core, `Only in Completed (${onlyInCompleted.length}) → set QA-Board: Tested`, async () => {
        for (const item of onlyInCompleted) {
            core.info(`#${item.number} ${item.title}`);
            await updateSingleSelectField(github, {
                projectId,
                itemId: item.itemId,
                fieldId: config.project.fields.status_qa_board.id,
                optionId: config.project.fields.status_qa_board.options.tested.id,
            });
        }
    });

    await logGroup(core, `Only in Tested (${onlyInTested.length}) → set Status: Completed`, async () => {
        for (const item of onlyInTested) {
            core.info(`#${item.number} ${item.title}`);
            await updateSingleSelectField(github, {
                projectId,
                itemId: item.itemId,
                fieldId: config.project.fields.status.id,
                optionId: config.project.fields.status.options.completed.id,
            });
        }
    });

    core.info("✔ Sync completed");
}