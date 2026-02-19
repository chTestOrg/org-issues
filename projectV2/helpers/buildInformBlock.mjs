const BLOCK_START = "<!-- AUTO-INFO-BLOCK-START -->";
const BLOCK_END = "<!-- AUTO-INFO-BLOCK-END -->";

export const AUTO_BLOCK = {
    start: "<!-- AUTO-INFO-BLOCK-START -->";
    end: BLOCK_END,
};


const ALERT_TYPES = {
    warning: "[!WARNING]",
    important: "[!IMPORTANT]",
    note: "[!NOTE]",
    tip: "[!TIP]",
};

export function buildInfoBlock({ type, content }) {
    // Визначаємо префікс (наприклад, [!WARNING]), або лишаємо тип як є, якщо його немає в списку
    const alertTag = ALERT_TYPES[type.toLowerCase()] || `[!${type.toUpperCase()}]`;

    // Додаємо символ "> " до кожного рядка контенту, щоб весь блок був цитатою
    const formattedContent = content
        .split("\n")
        .map(line => `> ${line}`)
        .join("\n");

    return `${AUTO_BLOCK.start}
---
> ${alertTag}
${formattedContent}
---
${AUTO_BLOCK.end}`;
}