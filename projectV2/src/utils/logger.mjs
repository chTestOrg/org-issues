export function logGroup(core, title, fn) {
    core.startGroup(title);
    return Promise.resolve(fn()).finally(() => core.endGroup());
}