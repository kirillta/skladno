import path from "node:path";
import { readFileSync } from "node:fs";
import { FuseV1Options, FuseVersion } from "@electron/fuses";


const rootPackage = JSON.parse(readFileSync(path.join(import.meta.dirname, "..", "..", "package.json"), "utf8"));


export default {
    packagerConfig: {
        asar: true,
        appBundleId: "io.github.kirillta.skladno",
        executableName: "Skladno",
        icon: path.join(import.meta.dirname, "assets", "icon.ico"),
        extraResource: [path.join(import.meta.dirname, "..", "web", "dist")],
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
