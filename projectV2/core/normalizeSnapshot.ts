import fs from "fs";
import path from "path";

function normalizeKey(name: string) {
    return name
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, "")
        .replace(/\s+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "");
}

export function normalizeSnapshot(
    fileName: string,
    inputPath: string,
    outputDir: string
) {
    const resolvedInputPath = path.resolve(inputPath);
    const resolvedOutputDir = path.resolve(outputDir);

    if (!fs.existsSync(resolvedInputPath)) {
        throw new Error(`Input file not found: ${resolvedInputPath}`);
    }

    // створити директорію якщо її нема
    if (!fs.existsSync(resolvedOutputDir)) {
        fs.mkdirSync(resolvedOutputDir, { recursive: true });
    }

    const raw = JSON.parse(
        fs.readFileSync(resolvedInputPath, "utf8")
    );

    const project = raw.project;
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

    const output =
        `module.exports = ${JSON.stringify(normalized, null, 2)};\n`;

    // якщо користувач не передав .js — додаємо
    const finalFileName = fileName.endsWith(".js")
        ? fileName
        : `${fileName}.config.js`;

    const outputPath = path.join(resolvedOutputDir, finalFileName);

    fs.writeFileSync(outputPath, output, "utf8");

    return outputPath;
}

