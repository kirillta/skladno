import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { resolve, relative } from "node:path";
import process from "node:process";
import { error as logError, log } from "node:console";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import Ajv from "ajv";


const root = process.cwd();
const modelDirectory = resolve(root, "product-model", "areas");
const schemaPath = resolve(root, "product-model", "schema", "product-area.schema.json");
const execFileAsync = promisify(execFile);


function relativePath(path) {
    return relative(root, path).replaceAll("\\", "/");
}


async function readJson(path) {
    return JSON.parse(await readFile(path, "utf8"));
}


async function areaFiles() {
    const entries = await readdir(modelDirectory, { withFileTypes: true });

    return entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
        .map((entry) => resolve(modelDirectory, entry.name));
}


function errorsFor(validator) {
    return (validator.errors ?? [])
        .map((error) => `${error.instancePath || "/"} ${error.message ?? "is invalid"}`)
        .join("; ");
}


async function exists(path) {
    try {
        await stat(path);

        return true;
    } catch {
        return false;
    }
}


async function validateArea(area, path, validator) {
    const failures = [];
    if (!validator(area))
        failures.push(`${relativePath(path)}: ${errorsFor(validator)}`);

    const capabilityIds = new Set();
    const scenarioIds = new Set();
    for (const capability of area.capabilities ?? []) {
        if (capabilityIds.has(capability.id))
            failures.push(`${relativePath(path)}: duplicate capability ID ${capability.id}`);

        capabilityIds.add(capability.id);
        if (capability.status === "partial" && capability.limitations?.length === 0)
            failures.push(`${relativePath(path)}: partial capability ${capability.id} needs a concrete limitation`);

        if (capability.status === "deferred" && !capability.tracking)
            failures.push(`${relativePath(path)}: deferred capability ${capability.id} needs tracking`);

        if (capability.status === "retired" && !capability.decision)
            failures.push(`${relativePath(path)}: retired capability ${capability.id} needs a decision`);

        for (const owner of capability.owners ?? []) {
            if (!await exists(resolve(root, owner)))
                failures.push(`${relativePath(path)}: ${capability.id} references missing owner ${owner}`);
        }
    }

    for (const scenario of area.scenarios ?? []) {
        if (scenarioIds.has(scenario.id))
            failures.push(`${relativePath(path)}: duplicate scenario ID ${scenario.id}`);

        scenarioIds.add(scenario.id);
        for (const capabilityId of scenario.capabilityIds ?? []) {
            if (!capabilityIds.has(capabilityId))
                failures.push(`${relativePath(path)}: scenario ${scenario.id} references unknown capability ${capabilityId}`);
        }

        const evidencePath = resolve(root, scenario.evidence?.path ?? "");
        if (!await exists(evidencePath)) {
            failures.push(`${relativePath(path)}: scenario ${scenario.id} references missing evidence ${scenario.evidence?.path}`);
            continue;
        }

        if (scenario.evidence?.kind === "automated") {
            const evidence = await readFile(evidencePath, "utf8");
            if (!evidence.includes(scenario.id))
                failures.push(`${relativePath(path)}: automated scenario ${scenario.id} is not marked in ${scenario.evidence.path}`);
        }
    }

    for (const capability of area.capabilities ?? []) {
        for (const scenarioId of capability.scenarioIds ?? []) {
            if (!scenarioIds.has(scenarioId))
                failures.push(`${relativePath(path)}: capability ${capability.id} references unknown scenario ${scenarioId}`);
        }
    }

    return failures;
}


function titleCaseStatus(status) {
    return `${status[0].toUpperCase()}${status.slice(1)}`;
}


function titleCaseArea(area) {
    return area.split("-").map((part) => `${part[0].toUpperCase()}${part.slice(1)}`).join(" ");
}


function generatedInventoryPath(area) {
    return resolve(root, "docs", "development", "product", `${area.area}-inventory.md`);
}


function renderInventory(area) {
    const rows = area.capabilities.map((capability) => [
        capability.id,
        capability.area,
        capability.title,
        titleCaseStatus(capability.status),
        `${capability.owners.join(", ")}; ${capability.contract} ${capability.persistence}`,
    ].map((value) => value.replaceAll("|", "\\|")).join(" | "));

    return [
        `# ${titleCaseArea(area.area)} inventory`,
        "",
        `This file is generated from \`product-model/areas/${area.area}.json\`. Edit the canonical product model, then run \`npm run product:docs\`.`,
        "",
        "| ID | Area | Feature | Status | Owner / contract |",
        "|---|---|---|---|---|",
        ...rows.map((row) => `| ${row} |`),
        "",
    ].join("\n");
}


async function loadAreas() {
    return Promise.all((await areaFiles()).map(readJson));
}


async function check() {
    const schema = await readJson(schemaPath);
    const validator = new Ajv({ allErrors: true, strict: true }).compile(schema);
    const files = await areaFiles();
    const areas = await Promise.all(files.map(readJson));
    const failures = (await Promise.all(areas.map((area, index) => validateArea(area, files[index], validator)))).flat();
    for (const area of areas) {
        const generated = renderInventory(area);
        const inventoryPath = generatedInventoryPath(area);
        const existing = await exists(inventoryPath) ? await readFile(inventoryPath, "utf8") : "";
        if (existing !== generated)
            failures.push(`${relativePath(inventoryPath)} is out of date; run npm run product:docs`);
    }

    if (failures.length > 0) {
        for (const failure of failures)
            logError(failure);

        process.exitCode = 1;
        return;
    }

    log(`Validated ${areas.length} product-model area${areas.length === 1 ? "" : "s"}.`);
}


async function generate() {
    const areas = await loadAreas();
    for (const area of areas) {
        const inventoryPath = generatedInventoryPath(area);
        await writeFile(inventoryPath, renderInventory(area), "utf8");
        log(`Generated ${relativePath(inventoryPath)}.`);
    }
}


async function impact() {
    const paths = process.argv.slice(3).map((path) => path.replaceAll("\\", "/"));
    const areas = await loadAreas();
    const matches = areas.flatMap((area) => area.capabilities.filter((capability) => capability.owners.some((owner) => paths.some((path) => path === owner || path.startsWith(`${owner}/`)))));

    for (const capability of matches)
        log(`${capability.id}: ${capability.title}`);
}


async function changedPaths(base, head) {
    const { stdout } = await execFileAsync("git", ["diff", "--name-only", base, head], { cwd: root });

    return stdout.split("\n").filter(Boolean).map((path) => path.replaceAll("\\", "/"));
}


function capabilitiesForPaths(areas, paths) {
    const productPaths = paths.filter((path) => !/\.test\.[^/]+$/.test(path));

    return areas.flatMap((area) => area.capabilities
        .filter((capability) => capability.owners.some((owner) => productPaths.some((path) => path === owner || path.startsWith(`${owner}/`))))
        .map((capability) => ({ area: area.area, capability })));
}


async function checkChanges() {
    const [base, head] = process.argv.slice(3);
    if (!base || !head)
        throw new Error("check-changes requires a base and head Git revision.");

    const paths = await changedPaths(base, head);
    const matches = capabilitiesForPaths(await loadAreas(), paths);
    const impactedAreas = [...new Set(matches.map(({ area }) => area))];
    const failures = impactedAreas
        .filter((area) => !paths.includes(`product-model/areas/${area}.json`))
        .map((area) => `Changes affect ${area}, but product-model/areas/${area}.json was not updated.`);

    for (const { capability } of matches)
        log(`${capability.id}: ${capability.title}`);

    if (failures.length === 0)
        return;

    for (const failure of failures)
        logError(failure);

    process.exitCode = 1;
}


const command = process.argv[2] ?? "check";
if (command === "check")
    await check();
else if (command === "generate")
    await generate();
else if (command === "impact")
    await impact();
else if (command === "check-changes")
    await checkChanges();
else
    throw new Error(`Unknown product-model command: ${command}`);
