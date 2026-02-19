/**
 * Знаходить усі згадки issues у тексті та повертає масив унікальних об'єктів.
 *
 * Функція шукає посилання на GitHub issues у форматах:
 * - Повний URL: https://github.com/${owner}/${repo}/issues/${number}
 * - Скорочений формат: ${owner}/${repo}/issues/${number}
 *
 * @param {string} text - Текст, в якому шукаються посилання на issues.
 *
 * @returns {Array} Масив об'єктів, що містять:
 *  - owner: Назва власника репозиторію.
 *  - repo: Назва репозиторію.
 *  - number: Номер issue.
 *  - url: Повний URL до GitHub issues.
 */
export function parseLinkedIssues(text) {
    if (!text) return [];

    const regex = /(?:https?:\/\/github\.com\/)?([^/\s]+)\/([^/\s]+)\/issues\/(\d+)\b/gi;
    const issues = [];
    const seen = new Set();

    for (const [_, owner, repo, numberStr] of text.matchAll(regex)) {
        const number = parseInt(numberStr, 10);
        const id = `${owner}/${repo}/${number}`.toLowerCase();

        if (!seen.has(id)) {
            seen.add(id);
            issues.push({
                owner,
                repo,
                number,
                url: `https://github.com/${owner}/${repo}/issues/${number}`
            });
        }
    }
    return issues;
}
