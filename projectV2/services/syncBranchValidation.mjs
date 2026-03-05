import { buildInfoBlock, stripAutoInfoBlocks } from "../helpers/buildInformBlock.mjs";

const VALIDATION_BLOCK = {
    start: "<!-- AUTO-GENERATED:BRANCH-VALIDATION:START -->",
    end: "<!-- AUTO-GENERATED:BRANCH-VALIDATION:END -->",
};

export async function syncBranchValidation({ github, context, core }, baseBranch, enrichedIssues, pr) {
    const { owner, repo } = context.repo;
    const originalBody = pr.body ?? "";

    core.info("=== BRANCH VALIDATION SYNC START ===");

    const isPrereleaseBranch = baseBranch === 'prerelease';
    let hasError = false;
    let hasWarning = false;
    const messages = [];

    // 1. Проводимо валідацію
    for (const issue of enrichedIssues) {
        const hasPrereleaseLabel = issue.labels.includes('Prerelease');

        if (isPrereleaseBranch && !hasPrereleaseLabel) {
            hasError = true;
            messages.push(`Issue #${issue.number}: Missing 'Prerelease' label for '${baseBranch}' branch.`);
        }

        if (!isPrereleaseBranch && hasPrereleaseLabel) {
            hasWarning = true;
            messages.push(`Issue #${issue.number}: Has 'Prerelease' label, but merging into '${baseBranch}'.`);
        }
    }

    // 2. Очищуємо старий блок валідації (якщо він був)
    // Використовуємо ваш новий універсальний stripAutoInfoBlocks з маркерами
    const cleanBody = stripAutoInfoBlocks(originalBody, VALIDATION_BLOCK);

    // 3. Формуємо новий блок
    let newBlock = "";
    if (messages.length > 0) {
        const alertType = hasError ? "caution" : "warning";

        // buildInfoBlock вже включає markers всередині себе (start/end)
        newBlock = buildInfoBlock({
            type: alertType,
            content: messages.join("\n"),
            markers: VALIDATION_BLOCK
        });
    }

    // 4. Збираємо фінальний body
    // Якщо нових повідомлень немає, finalBody буде просто чистим текстом без блоку
    const finalBody = newBlock ? `${cleanBody}\n\n${newBlock}`.trim() : cleanBody.trim();

    // 5. Оновлюємо PR тільки при наявності змін
    if (finalBody !== originalBody.trim()) {
        await github.rest.pulls.update({
            owner,
            repo,
            pull_number: pr.number,
            body: finalBody
        });
        core.notice("PR body updated: Branch/Label validation status changed.");
    } else {
        core.info("Validation block is already up to date.");
    }

    // 6. Виставляємо статус Check-у
    if (hasError) {
        core.setFailed("Branch validation failed. See PR description for details.");
    }

    core.info("=== BRANCH VALIDATION SYNC END ===");

    return { hasError, hasWarning };
}