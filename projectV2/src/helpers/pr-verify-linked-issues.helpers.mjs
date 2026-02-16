const IMPORTANT_START = "<!-- AUTO-LINKED-ISSUES-START -->";
const IMPORTANT_END = "<!-- AUTO-LINKED-ISSUES-END -->";
const WARNING_START = "<!-- AUTO-WARNING-START -->";
const WARNING_END = "<!-- AUTO-WARNING-END -->";

function removeBlock(body, start, end) {
    const regex = new RegExp(`${start}[\\s\\S]*?${end}`, "m");
    return body.replace(regex, "").trim();
}

export function stripAutoBlocks(body) {
    let result = removeBlock(body, IMPORTANT_START, IMPORTANT_END);
    result = removeBlock(result, WARNING_START, WARNING_END);
    return result;
}

export function extractIssues(body, owner) {
    const issueRegex = new RegExp(
        `https:\\/\\/github\\.com\\/${owner}\\/([\\w-]+)\\/issues\\/(\\d+)`,
        "gi"
    );

    const map = new Map();

    for (const match of body.matchAll(issueRegex)) {
        const repo = match[1];
        const num = Number(match[2]);
        if (!repo || !num) continue;

        if (!map.has(repo)) map.set(repo, new Set());
        map.get(repo).add(num);
    }

    return map;
}

export function buildImportantBlock(owner, sections) {
    let block = `${IMPORTANT_START}
---
> [!IMPORTANT]
> ### Linked Issues:
`;

    for (const section of sections) {
        if (sections.length > 1) {
            block += `> **Repository: ${section.repo}**\n`;
        }

        for (const issue of section.issues) {
            block += `> Closes: [${issue.title} #${issue.number}](https://github.com/${owner}/${section.repo}/issues/${issue.number})\n`;
        }
    }

    block += `${IMPORTANT_END}`;
    return block;
}

export function buildWarningBlock() {
    return `${WARNING_START}
---
> [!WARNING]
> Для повного процесу автоматизації цього пулреквеста необхідно прив’язати задачі у форматі GitHub Issues URL.
---
${WARNING_END}`;
}
