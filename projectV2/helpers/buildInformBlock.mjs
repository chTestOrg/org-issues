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