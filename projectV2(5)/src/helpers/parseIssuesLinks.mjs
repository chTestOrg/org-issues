export function extractIssuesFromBody(body, owner) {
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
