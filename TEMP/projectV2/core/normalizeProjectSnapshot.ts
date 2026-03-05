import fs from "fs";
import path from "path";

const snapshotPath = path.resolve(
    process.cwd(),
    "projectV2/config/project-org-dev-board-snapshot.json"
);

const raw = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));

const project = raw.project;

function normalizeKey(name: string) {
    return name.toLowerCase()
        //.replace(/\s+/g, "");
        // прибираємо emoji та інші не-ASCII символи
        .replace(/[^\p{L}\p{N}\s]/gu, "")
        // пробіли -> _
        .replace(/\s+/g, "_")
        // прибрати подвійні _
        .replace(/_+/g, "_")
        // прибрати _ на початку/в кінці
        .replace(/^_+|_+$/g, "");
}

const fields: Record<string, any> = {};

for (const field of project.fields.nodes) {
    const key = normalizeKey(field.name);

    if (field.__typename === "ProjectV2SingleSelectField") {
        const options: Record<string, any> = {};

        for (const opt of field.options) {
            options[normalizeKey(opt.name)] = {
                id: opt.id,
                name: opt.name,
            };
        }

        fields[key] = {
            id: field.id,
            type: "SINGLE_SELECT",
            options,
        };
    } else {
        fields[key] = {
            id: field.id,
            type: field.dataType,
        };
    }
}

const normalized = {
    meta: {
        fetchedAt: raw.fetchedAt,
        organization: raw.organization,
        projectNumber: raw.projectNumber,
    },
    project: {
        id: project.id,
        title: project.title,
        fields,
    },
};

const output = `export const config = ${JSON.stringify(normalized, null, 2)};\n`;

const outPath = path.resolve(
    process.cwd(),
    "projectV2/config/project-org-dev-board.mjs"
);

fs.writeFileSync(outPath, output, "utf8");

console.log("✅ Normalized config saved:", outPath);
