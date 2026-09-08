import { spawn } from "node:child_process";
import { lookup } from "node:dns/promises";
import { createServer } from "node:net";


async function isPortAvailable(port) {
    const { address } = await lookup("localhost");
    return new Promise((resolve, reject) => {
        const server = createServer();
        server.once("error", (error) => error.code === "EADDRINUSE" ? resolve(false) : reject(error));
        server.listen({ port, host: address }, () => server.close(() => resolve(true)));
    });
}


if (await isPortAvailable(5173)) {
    const command = process.platform === "win32" ? "npm.cmd" : "npm";
    const vite = spawn(command, ["run", "dev", "--workspace", "@skladno/web"], { stdio: "inherit", shell: process.platform === "win32" });
    vite.once("exit", (code) => process.exit(code ?? 1));
} else {
    console.log("Reusing the Vite development server on port 5173.");
}
