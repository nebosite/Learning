// Quick and dirty "build all" script.
// This should probably be replaced with a Gulp script in the future
// so that we get file watching and/or simultaneous builds

const child_process = require("child_process");

// Run a process, returning a promise that resolves or rejects when it ends
function promisifyProcess(command, options) {
    return new Promise((resolve, reject) => {
        const p = child_process.spawn(command, options);
        p.on("exit", (code, signal) => {
            if (signal) {
                reject(new Error("ERROR: Process terminated with signal " + signal));
            } else if (code !== 0) {
                reject(new Error("ERROR: Process terminated with exit code " + code));
            } else {
                resolve();
            }
        })
    });
}

// Run a process with inherited stdio and in the given cwd
// Note that this is needed because process.execSync returns stdout
// as a string, limiting potential output length
function promisifySingleStep(command, cwd) {
    return promisifyProcess(command, { cwd, shell: true, stdio: "inherit" });
}

// Run npm install and npm run build in the given directory
async function installAndBuild(cwd) {
    await promisifySingleStep("npm install", cwd);
    await promisifySingleStep("npm run build", cwd);
}

// Main work
(async function() {
    await installAndBuild('./common');
    await installAndBuild('./clientapp');
    await installAndBuild('./webserver');
})();
