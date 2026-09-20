import { cpSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const [source, destination] = process.argv.slice(2);
if (!source || !destination)
    throw new Error("missing_skill_asset_paths");

mkdirSync(dirname(resolve(destination)), { recursive: true });
cpSync(resolve(source), resolve(destination), { recursive: true });
