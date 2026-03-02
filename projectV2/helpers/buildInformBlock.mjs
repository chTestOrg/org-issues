//projectV2/helpers/buildInformBlock.mjs
const AUTO_BLOCK = {
    start: "<!-- AUTO-INFO-BLOCK-START -->",
    end: "<!-- AUTO-INFO-BLOCK-END -->",
};


const ALERT_TYPES = {
    warning: "[!WARNING]",
    important: "[!IMPORTANT]",
    caution: "[!CAUTION]",
    note: "[!NOTE]",
    tip: "[!TIP]",
};

export function buildInfoBlock({type, content}) {
    // Визначаємо префікс (наприклад, [!WARNING]), або лишаємо тип як є, якщо його немає в списку
    const alertTag = ALERT_TYPES[type.toLowerCase()] || `[!${type.toUpperCase()}]`;

    // Додаємо символ "> " до кожного рядка контенту, щоб весь блок був цитатою
    const formattedContent = content
        .split("\n")
        .map(line => `> ${line}`)
        .join("\n");

    return`${AUTO_BLOCK.start}
---
> ${alertTag}
${formattedContent}
---
${AUTO_BLOCK.end}`;
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function removeInfoBlocks(body = "") {
    if (!body) return "";

    const start = escapeRegExp(AUTO_BLOCK.start.trim());
    const end = escapeRegExp(AUTO_BLOCK.end.trim());

    const regex = new RegExp(
        `\\s*${start}[\\s\\S]*?${end}\\s*`,
        "g"
    );

    return body.replace(regex, "").trim();
}

export function stripAutoInfoBlocks(body = "") {
    if (!body) return "";
    let result = body;

    while (true) {
        const startIndex = result.indexOf(AUTO_BLOCK.start);
        if (startIndex === -1) break;

        const endIndex = result.indexOf(AUTO_BLOCK.end, startIndex);
        if (endIndex === -1) break;

        const blockEnd = endIndex + AUTO_BLOCK.end.length;

        result =
            result.slice(0, startIndex) +
            result.slice(blockEnd);
    }

    return result.trim();
}