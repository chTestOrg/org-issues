import { App } from "octokit";
//import prSyncLinkedIssues from "../../../projectV2/workflows/prVerifyLinkedIssues.mjs";
//import prSyncLinkedIssues from "../../../projectV2/workflows/prSyncLinkedIssues.mjs";
import prOpened from "../../../projectV2/workflows/pr-opened.mjs";
import prMerged from "../../../projectV2/workflows/pr-merged.mjs";
import { githubConfig } from "../config.ts";
//import testBody from "../../../projectV2/workflows/testBody.mjs";

const { appId, privateKey } = githubConfig;

const ORG_NAME = "chTestORG";
const PR_REPO = "org-front-end";
const PR_NUMBER = 78;

// =============================
// 🧪 Fake core (GitHub Actions logger)
// =============================
const core = {
    info: console.log,
    notice: (msg: any) => console.log("🔔", msg),
    warning: (msg: any) => console.warn("⚠️", msg),
    error: (msg:any) => console.error("❌", msg),
    setFailed: (msg: any) => console.error("🛑 FAILED:", msg),
    startGroup: (name:any) => console.log(`\n▶ ${name}`),
    endGroup: () => console.log("◀ end\n"),
};

// =============================
// 🚀 Main
// =============================
async function run() {
    console.log("🔐 Initializing GitHub App…");

    const app = new App({
        appId,
        privateKey,
    });

    await app.octokit.request("GET /app");
    console.log("✅ App authenticated");

    const { data: installation } =
        await app.octokit.rest.apps.getOrgInstallation({
            org: ORG_NAME,
        });

    console.log("✅ Installation:", installation.id);

    const octokit = await app.getInstallationOctokit(installation.id);

    // =============================
    // 🧪 Fake context (як у Actions)
    // =============================
    const context = {
        repo: {
            owner: ORG_NAME,
            repo: PR_REPO,
        },
        payload: {
            pull_request: {
                number: PR_NUMBER,
            },
        },
    };

    // =============================
    // ▶ Run workflow
    // =============================
    //await prMerged({
    await prOpened({
        github: octokit,
        context,
        core,
    });

    console.log("🏁 Done");
    try {
        const response = await octokit.rest.rateLimit.get();
        const { core } = response.data.resources;

        console.log(`Rate Limit Status:`);
        console.log(`Limit: ${core.limit}`);
        console.log(`Remaining: ${core.remaining}`);
        console.log(`Used: ${core.used}`);
        // The reset time is in UTC epoch seconds
        console.log(`Reset time (UTC epoch seconds): ${core.reset}`);

        // You can convert the reset time to a readable date
        const resetTime = new Date(core.reset * 1000);
        console.log(`Reset time (local time): ${resetTime.toLocaleTimeString()}`);

    } catch (error) {
        console.error("Error fetching rate limit:", error);
    }

}

run().catch((e) => {
    console.error("❌ Error:", e);
});
