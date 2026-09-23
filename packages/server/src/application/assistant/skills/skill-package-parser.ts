import { lstatSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { parseDocument } from "yaml";

import { createSkillPackage } from "./create-skill-package.js";
import { normalizeSkillName } from "./normalize-skill-name.js";
import type { SkillPackageIssue } from "./skill-package-issue.js";
import type { SkillPackageParseResult } from "./skill-package-parse-result.js";


const maximumPackageBytes = 96 * 1024;
const maximumInstructionsBytes = 64 * 1024;
const maximumReferenceCount = 8;
const maximumReferenceBytes = 16 * 1024;
const skillId = /^[a-z][a-z0-9_-]{2,63}$/;
const supportedMetadata = new Set(["id", "name", "description", "version", "references"]);
const messageIds: Record<SkillPackageIssue["code"], SkillPackageIssue["messageId"]> = {
    invalid_frontmatter: "skills.validation.invalid_frontmatter",
    invalid_metadata: "skills.validation.invalid_metadata",
    invalid_instructions: "skills.validation.invalid_instructions",
    invalid_reference: "skills.validation.invalid_reference",
    unsafe_package: "skills.validation.unsafe_package",
    package_too_large: "skills.validation.package_too_large",
};


interface ParsedSkillMetadata {
    id: string;
    name: string;
    description: string;
    version: string;
    instructions: string;
    references: string[];
}


function issue(code: SkillPackageIssue["code"]): SkillPackageParseResult {
    return { ok: false, issues: [{ code, messageId: messageIds[code] }] };
}


function utf8Length(value: string): number {
    return Buffer.byteLength(value, "utf8");
}


function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}


function splitFrontmatter(text: string): { frontmatter: string; instructions: string } | undefined {
    const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]+)$/.exec(text);
    return match ? { frontmatter: match[1]!, instructions: match[2]!.trim() } : undefined;
}


function readMetadata(frontmatter: string): Record<string, unknown> | undefined {
    const document = parseDocument(frontmatter, { schema: "core", strict: true, uniqueKeys: true });
    if (document.errors.length > 0)
        return undefined;

    const value = document.toJSON();
    return isRecord(value) ? value : undefined;
}


function isSafeReferencePath(value: string): boolean {
    return value.startsWith("references/")
        && value.endsWith(".md")
        && !value.includes("\\")
        && !value.split("/").some((part) => part === "" || part === "." || part === "..");
}


function isInside(root: string, candidate: string): boolean {
    const path = relative(root, candidate);
    return path !== "" && !path.startsWith(`..${sep}`) && path !== "..";
}


function listFiles(root: string): string[] {
    const files: string[] = [];
    for (const entry of readdirSync(root, { withFileTypes: true })) {
        const path = resolve(root, entry.name);
        if (entry.isSymbolicLink())
            throw new Error("unsafe_package");

        if (entry.isDirectory()) {
            files.push(...listFiles(path));
            continue;
        }

        if (!entry.isFile())
            throw new Error("unsafe_package");

        files.push(path);
    }

    return files;
}


function readSkillFile(root: string, skillPath: string): string | SkillPackageParseResult {
    try {
        if (!lstatSync(root).isDirectory() || lstatSync(skillPath).isSymbolicLink() || !lstatSync(skillPath).isFile())
            return issue("unsafe_package");

        if (realpathSync(root) !== root || !isInside(root, realpathSync(skillPath)))
            return issue("unsafe_package");
    } catch {
        return issue("unsafe_package");
    }

    try {
        if (statSync(skillPath).size > maximumPackageBytes)
            return issue("package_too_large");

        const text = readFileSync(skillPath, "utf8");
        return utf8Length(text) > maximumPackageBytes ? issue("package_too_large") : text;
    } catch {
        return issue("unsafe_package");
    }
}


function readInstructions(text: string): { frontmatter: string; instructions: string } | SkillPackageParseResult {
    const parts = splitFrontmatter(text);
    if (!parts)
        return issue("invalid_frontmatter");

    if (utf8Length(parts.instructions) > maximumInstructionsBytes || !parts.instructions.trim())
        return issue("invalid_instructions");

    return parts;
}


function validateSkillIdentity(input: { reservedIds?: readonly string[]; reservedNames?: readonly string[] }, metadata: Record<string, unknown>): { id: string; name: string; description: string; version: string } | SkillPackageParseResult {
    const { id, name, description, version } = metadata;
    const versionText = typeof version === "string" || typeof version === "number" ? String(version) : undefined;
    if (typeof id !== "string" || !skillId.test(id) || typeof name !== "string" || !name.trim() || name.length > 80
        || typeof description !== "string" || !description.trim() || description.length > 280 || !versionText || !/^\d+(?:\.\d+){0,2}$/.test(versionText))
        return issue("invalid_metadata");

    if ((input.reservedIds ?? []).includes(id) || (input.reservedNames ?? []).some((candidate) => normalizeSkillName(candidate) === normalizeSkillName(name)))
        return issue("invalid_metadata");

    return { id, name: name.trim(), description: description.trim(), version: versionText };
}


function validateSkillReferences(references: unknown): references is string[] {
    return Array.isArray(references) && references.length <= maximumReferenceCount
        && references.every((reference) => typeof reference === "string" && isSafeReferencePath(reference));
}


function readSkillMetadata(frontmatter: string, instructions: string, input: { reservedIds?: readonly string[]; reservedNames?: readonly string[] }): ParsedSkillMetadata | SkillPackageParseResult {
    let metadata: Record<string, unknown> | undefined;
    try {
        metadata = readMetadata(frontmatter);
    } catch {
        return issue("invalid_frontmatter");
    }

    if (!metadata || Object.keys(metadata).some((key) => !supportedMetadata.has(key)))
        return issue("invalid_metadata");

    const identity = validateSkillIdentity(input, metadata);
    if ("ok" in identity)
        return identity;

    const references = metadata.references ?? [];
    if (!validateSkillReferences(references))
        return issue("invalid_reference");

    return { ...identity, instructions, references };
}


function readSkillReference(root: string, reference: string): string | SkillPackageParseResult {
    const path = resolve(root, reference);
    try {
        if (!isInside(root, path) || !lstatSync(path).isFile() || lstatSync(path).isSymbolicLink() || dirname(path) !== resolve(root, "references"))
            return issue("unsafe_package");

        if (statSync(path).size > maximumReferenceBytes)
            return issue("invalid_reference");

        return readFileSync(path, "utf8");
    } catch {
        return issue("invalid_reference");
    }
}


function readSkillReferences(root: string, skillPath: string, text: string, metadata: ParsedSkillMetadata): string[] | SkillPackageParseResult {
    let packageFiles: string[];
    try {
        packageFiles = listFiles(root);
    } catch {
        return issue("unsafe_package");
    }

    const expected = new Set([skillPath, ...metadata.references.map((reference) => resolve(root, reference))]);
    if (packageFiles.some((path) => !expected.has(path)))
        return issue("unsafe_package");

    const loadedReferences: string[] = [];
    let totalBytes = utf8Length(text);
    for (const reference of metadata.references) {
        const content = readSkillReference(root, reference);
        if (typeof content !== "string")
            return content;

        totalBytes += Buffer.byteLength(content, "utf8");
        loadedReferences.push(content);
    }

    if (totalBytes > maximumPackageBytes)
        return issue("package_too_large");

    return loadedReferences;
}


/** Parses the documented SKILL.md format. All filesystem paths remain server-owned. */
export function parseSkillPackage(input: { root: string; source: string; reservedIds?: readonly string[]; reservedNames?: readonly string[] }): SkillPackageParseResult {
    const root = resolve(input.root);
    const skillPath = resolve(root, "SKILL.md");
    const text = readSkillFile(root, skillPath);
    if (typeof text !== "string")
        return text;

    const instructions = readInstructions(text);
    if ("ok" in instructions)
        return instructions;

    const metadata = readSkillMetadata(instructions.frontmatter, instructions.instructions, input);
    if ("ok" in metadata)
        return metadata;

    const loadedReferences = readSkillReferences(root, skillPath, text, metadata);
    if (!Array.isArray(loadedReferences))
        return loadedReferences;

    return {
        ok: true,
        skillPackage: createSkillPackage({
            reference: { source: input.source, id: metadata.id, version: metadata.version },
            name: metadata.name,
            description: metadata.description,
            instructions: metadata.instructions,
            references: loadedReferences
        })
    };
}
