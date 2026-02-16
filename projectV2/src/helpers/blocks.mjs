export const IMPORTANT = {
    start: "<!-- AUTO-LINKED-ISSUES-START -->",
    end: "<!-- AUTO-LINKED-ISSUES-END -->",
};

export const WARNING = {
    start: "<!-- AUTO-WARNING-START -->",
    end: "<!-- AUTO-WARNING-END -->",
};

export function removeBlocks(body, blocks) {
    let result = body;
    for (const block of blocks) {
        const regex = new RegExp(`${block.start}[\\s\\S]*?${block.end}`, "m");
        result = result.replace(regex, "").trim();
    }
    return result;
}

export function buildWarningBlock() {
    return `${WARNING.start}
---
> [!WARNING]
> Для автоматизації потрібно додати посилання на GitHub Issues.
---
${WARNING.end}`;
}

export function buildImportantBlock(owner, sections) {
    let block = `${IMPORTANT.start}
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

    block += `${IMPORTANT.end}`;
    return block;
}
