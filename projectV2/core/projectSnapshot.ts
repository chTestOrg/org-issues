import fs from "fs";
import path from "path";
import { App } from "octokit";
import {githubConfig} from "../../octokit/config.ts";

// =============================
// 🔧 ENV
// =============================
const {appId, githubPrivateKey} = githubConfig

const APP_ID = appId;
const ORG_NAME = "chTestORG";
const PROJECT_NUMBER = 1;
const PRIVATE_KEY = githubPrivateKey;

if (!APP_ID || !ORG_NAME || !PROJECT_NUMBER || !PRIVATE_KEY) {
    throw new Error("❌ Missing required env variables");
}

// =============================
// 📡 GraphQL
// =============================
const PROJECT_QUERY = `
query ($org: String!, $number: Int!) {
  organization(login: $org) {
    projectV2(number: $number) {
      id
      title
      shortDescription
      fields(first: 50) {
        nodes {
          __typename
          ... on ProjectV2Field {
            id
            name
            dataType
          }
          ... on ProjectV2SingleSelectField {
            id
            name
            options {
              id
              name
            }
          }
        }
      }
    }
  }
}
`;

// =============================
// 🚀 Main
// =============================
async function run() {
    console.log("🔐 Initializing GitHub App…");

    // 1️⃣ App-level auth (JWT)
    const app = new App({
        appId: APP_ID,
        privateKey: PRIVATE_KEY,
    });

    // sanity check
    await app.octokit.request("GET /app");
    console.log("✅ App authenticated");

    // 2️⃣ Resolve installation for org
    const { data: installation } =
        await app.octokit.rest.apps.getOrgInstallation({
            org: ORG_NAME,
        });

    console.log("✅ Installation found:", installation.id);

    // 3️⃣ Installation-level Octokit
    const octokit = await app.getInstallationOctokit(installation.id);

    // 4️⃣ Fetch project structure
    const data = await octokit.graphql<{
        organization: {
            projectV2: {
                id: string;
                title: string;
                shortDescription: string | null;
                fields: {
                    nodes: any[];
                };
            };
        };
    }>(PROJECT_QUERY, {
        org: ORG_NAME,
        number: PROJECT_NUMBER,
    });

    const project = data.organization.projectV2;

    if (!project) {
        throw new Error("❌ Project not found or access denied");
    }

    console.log(`📦 Project loaded: ${project.title}`);
    console.log(`🆔 Project ID: ${project.id}`);

    // 5️⃣ Save snapshot
    const output = {
        fetchedAt: new Date().toISOString(),
        organization: ORG_NAME,
        projectNumber: PROJECT_NUMBER,
        project,
    };

    const outPath = path.resolve(
        process.cwd(),
        `projectV2/config/project-${project.title}-snapshot.json`
    );

    fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");

    console.log(`💾 Snapshot saved to ${outPath}`);
}

run().catch(err => {
    console.error("❌ Error:", err.message || err);
    process.exit(1);
});
