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


/** Parses the documented SKILL.md format. All filesystem paths remain server-owned. */
export function parseSkillPackage(input: { root: string; source: string; reservedIds?: readonly string[]; reservedNames?: readonly string[] }): SkillPackageParseResult {
    const root = resolve(input.root);
    const skillPath = resolve(root, "SKILL.md");
    try {
        if (!lstatSync(root).isDirectory() || lstatSync(skillPath).isSymbolicLink() || !lstatSync(skillPath).isFile())
            return issue("unsafe_package");

        if (realpathSync(root) !== root || !isInside(root, realpathSync(skillPath)))
            return issue("unsafe_package");
    } catch {
        return issue("unsafe_package");
    }

    let text: string;
    try {
        if (statSync(skillPath).size > maximumPackageBytes)
            return issue("package_too_large");

        text = readFileSync(skillPath, "utf8");
    } catch {
        return issue("unsafe_package");
    }

    if (utf8Length(text) > maximumPackageBytes)
        return issue("package_too_large");

    const parts = splitFrontmatter(text);
    if (!parts)
        return issue("invalid_frontmatter");

    if (utf8Length(parts.instructions) > maximumInstructionsBytes || !parts.instructions.trim())
        return issue("invalid_instructions");

    let metadata: Record<string, unknown> | undefined;
    try {
        metadata = readMetadata(parts.frontmatter);
    } catch {
        return issue("invalid_frontmatter");
    }

    if (!metadata || Object.keys(metadata).some((key) => !supportedMetadata.has(key)))
        return issue("invalid_metadata");

    const { id, name, description, version, references = [] } = metadata;
    const versionText = typeof version === "string" || typeof version === "number" ? String(version) : undefined;
    if (typeof id !== "string" || !skillId.test(id) || typeof name !== "string" || !name.trim() || name.length > 80 || typeof description !== "string" || !description.trim() || description.length > 280 || !versionText || !/^\d+(?:\.\d+){0,2}$/.test(versionText))
        return issue("invalid_metadata");

    if ((input.reservedIds ?? []).includes(id) || (input.reservedNames ?? []).some((candidate) => normalizeSkillName(candidate) === normalizeSkillName(name)))
        return issue("invalid_metadata");

    if (!Array.isArray(references) || references.length > maximumReferenceCount || !references.every((reference) => typeof reference === "string" && isSafeReferencePath(reference)))
        return issue("invalid_reference");

    const packageFiles: string[] = [];
    try {
        packageFiles.push(...listFiles(root));
    } catch {
        return issue("unsafe_package");
    }

    const expected = new Set([skillPath, ...references.map((reference) => resolve(root, reference as string))]);
    if (packageFiles.some((path) => !expected.has(path)))
        return issue("unsafe_package");

    const loadedReferences: string[] = [];
    let totalBytes = utf8Length(text);
    for (const reference of references) {
        const path = resolve(root, reference as string);
        try {
            if (!isInside(root, path) || !lstatSync(path).isFile() || lstatSync(path).isSymbolicLink() || dirname(path) !== resolve(root, "references"))
                return issue("unsafe_package");

            if (statSync(path).size > maximumReferenceBytes)
                return issue("invalid_reference");

            const content = readFileSync(path, "utf8");
            totalBytes += Buffer.byteLength(content, "utf8");
            loadedReferences.push(content);
        } catch {
            return issue("invalid_reference");
        }
    }

    if (totalBytes > maximumPackageBytes)
        return issue("package_too_large");

    return {
        ok: true,
        skillPackage: createSkillPackage({
            reference: { source: input.source, id, version: versionText },
            name: name.trim(),
            description: description.trim(),
            instructions: parts.instructions,
            references: loadedReferences
        })
    };
}
