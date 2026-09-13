import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { SystemDateTimeFormat } from "@skladno/shared";

const execFileAsync = promisify(execFile);
const windowsInternationalKey = "HKCU\\Control Panel\\International";


async function getWindowsInternationalValue(name: "LocaleName" | "sShortDate" | "sTimeFormat"): Promise<string | undefined> {
    const result = await execFileAsync("reg.exe", ["query", windowsInternationalKey, "/v", name], { windowsHide: true });
    const value = new RegExp(`\\s${name}\\s+REG_SZ\\s+(.+)$`, "m").exec(result.stdout)?.[1]?.trim();

    return value || undefined;
}


export async function readSystemDateTimeFormat(): Promise<SystemDateTimeFormat> {
    if (process.platform !== "win32")
        return { locale: Intl.DateTimeFormat().resolvedOptions().locale };

    try {
        const [locale, datePattern, timePattern] = await Promise.all([
            getWindowsInternationalValue("LocaleName"),
            getWindowsInternationalValue("sShortDate"),
            getWindowsInternationalValue("sTimeFormat"),
        ]);

        return {
            locale,
            datePattern,
            timePattern,
        };
    } catch {
        return { locale: Intl.DateTimeFormat().resolvedOptions().locale };
    }
}
