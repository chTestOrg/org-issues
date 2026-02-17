const BLOCK_START = "<!-- AUTO-PR-LINKS-START -->";
const BLOCK_END = "<!-- AUTO-PR-LINKS-END -->";

export const AUTO_BLOCK = {
    start: BLOCK_START,
    end: BLOCK_END,
};

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function removeBlocks(body) {
    const regex = new RegExp(
        `${escapeRegExp(AUTO_BLOCK.start)}[\\s\\S]*?${escapeRegExp(AUTO_BLOCK.end)}`,
        "gm"
    );
    return (body ?? "").replace(regex, "").trim();
}

export function buildInfoBlock({ type, sections = [] }) {
    if (type === "warning") {
        return `${AUTO_BLOCK.start}
---
> [!WARNING]
> Для повного процесу автоматизації цього пулреквеста необхідно прив’язати задачі у форматі GitHub Issues URL.
---
${AUTO_BLOCK.end}`;
    }

    if (type !== "important") {
        throw new Error(`Unsupported block type: ${type}`);
    }

    let block = `${AUTO_BLOCK.start}
---
> [!IMPORTANT]
> ### Linked Issues:
`;

    for (const section of sections) {
        const repoLabel = section.owner ? `${section.owner}/${section.repo}` : section.repo;
        if (sections.length > 1) {
            block += `> **Repository: ${repoLabel}**\n`;
        }

        for (const issue of section.issues) {
            block += `> Closes: [${issue.title} #${issue.number}](${issue.url})\n`;
        }
    }

    block += `${AUTO_BLOCK.end}`;
    return block;
}
