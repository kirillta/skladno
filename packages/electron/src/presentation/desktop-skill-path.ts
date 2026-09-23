import { join } from "node:path";


export function getBuiltInSkillRoot({ packaged, appPath, resourcesPath }: { packaged: boolean; appPath: string; resourcesPath: string }): string {
    return packaged
        ? join(resourcesPath, "built-in")
        : join(appPath, "..", "server", "src", "application", "assistant", "skills", "built-in");
}
