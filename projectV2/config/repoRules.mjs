export const repoRules = {

    "front-end": {
        requireLinkedIssue: true,
        validateTargetBranch: true,
        moveToQaOnMerge: true,
        allowedBase: ["develop", "prerelease"],
    },
    "back-end": {
        requireLinkedIssue: true,
        validateTargetBranch: false,
        moveToQaOnMerge: true,
        allowedBase: "master",
    },
    "desktop-app": {
        validateTargetBranch: true,
        allowedBase: "main",
        requireLinkedIssue: false,
        moveToQaOnMerge: false
    }
};