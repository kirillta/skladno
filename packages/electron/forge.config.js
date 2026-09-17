import path from "node:path";
import { cpSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { FuseV1Options, FuseVersion } from "@electron/fuses";


const rootPackage = JSON.parse(readFileSync(path.join(import.meta.dirname, "..", "..", "package.json"), "utf8"));
const telemetryConfig = path.join(import.meta.dirname, "telemetry.json");


export default {
    hooks: {
        packageAfterCopy: async (_config, buildPath) => {
            const destination = path.join(buildPath, "dist", "node_modules", "@napi-rs");
            mkdirSync(destination, { recursive: true });
            const keyringPackage = process.platform === "linux"
                ? "keyring-linux-x64-gnu"
                : "keyring-win32-x64-msvc";

            for (const packageName of ["keyring", keyringPackage])
                cpSync(path.join(import.meta.dirname, "..", "..", "node_modules", "@napi-rs", packageName), path.join(destination, packageName), { recursive: true });
        },
    },
    packagerConfig: {
        asar: { unpack: "**/*.node" },
        appBundleId: "io.github.kirillta.skladno",
        executableName: "Skladno",
        icon: path.join(import.meta.dirname, "assets", "icon.ico"),
        extraResource: [path.join(import.meta.dirname, "..", "web", "dist"), ...(existsSync(telemetryConfig) ? [telemetryConfig] : [])],
    },
    makers: [
        {
            name: "@electron-forge/maker-squirrel",
            platforms: ["win32"],
            config: {
                name: "io.github.kirillta.skladno",
                setupExe: `Skladno-${rootPackage.version}-win32-x64-setup.exe`,
                setupIcon: path.join(import.meta.dirname, "assets", "icon.ico"),
            },
        },
        {
            name: "@electron-forge/maker-deb",
            platforms: ["linux"],
            config: {
                options: {
                    name: "skladno",
                    bin: "Skladno",
                    maintainer: "Kirill Taran",
                    homepage: "https://github.com/kirillta/skladno",
                    categories: ["Office"],
                    icon: path.join(import.meta.dirname, "assets", "icon.png"),
                },
            },
        },
    ],
    plugins: [
        {
            name: "@electron-forge/plugin-fuses",
            config: {
                version: FuseVersion.V1,
                [FuseV1Options.RunAsNode]: false,
                [FuseV1Options.EnableCookieEncryption]: true,
                [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
                [FuseV1Options.EnableNodeCliInspectArguments]: false,
                [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
                [FuseV1Options.OnlyLoadAppFromAsar]: true,
            },
        },
    ],
};
