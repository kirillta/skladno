import type { DesktopUpdateState } from "@skladno/shared";
import type { RuntimeSettings } from "../../infrastructure/runtime/runtime-settings.js";


export interface Release {
    tag_name: string;
    name?: string;
    body?: string;
    html_url: string;
    prerelease: boolean;
    draft: boolean;
    assets: { name: string }[];
}


const releaseVersion = /^v?(\d+)\.(\d+)\.(\d+)(?:-preview\.(\d+)(\.security)?)?$/;


function parseVersionParts(value: string): number[] | undefined {
    const match = releaseVersion.exec(value);
    if (!match)
        return undefined;

    const previewVersion = match[4] ? Number(match[4]) : Number.POSITIVE_INFINITY;
    return [Number(match[1]), Number(match[2]), Number(match[3]), previewVersion];
}


function isNewerThan(candidate: string, current: string): boolean {
    const left = parseVersionParts(candidate);
    const right = parseVersionParts(current);
    if (!left || !right)
        return false;

    for (let index = 0; index < left.length; index += 1) {
        if (left[index] !== right[index])
            return left[index]! > right[index]!;
    }

    return false;
}


function supportedRelease(value: unknown): value is Release {
    if (!value || typeof value !== "object" || Array.isArray(value))
        return false;

    const release = value as Record<string, unknown>;
    return typeof release.tag_name === "string"
        && typeof release.html_url === "string"
        && typeof release.prerelease === "boolean"
        && typeof release.draft === "boolean"
        && Array.isArray(release.assets)
        && release.assets.every((asset) => asset && typeof asset === "object" && typeof (asset as Record<string, unknown>).name === "string");
}


function hasSupportedVersion(release: Release): boolean {
    const match = releaseVersion.exec(release.tag_name);
    return match !== null && release.prerelease === Boolean(match[4]);
}


export function updatePreferences(settings: RuntimeSettings, currentVersion: string) {
    return {
        automaticChecks: settings.automaticUpdateChecks !== false,
        includePrereleases: settings.includePrereleaseUpdates ?? currentVersion.includes("-preview."),
        networkAccess: settings.updateNetworkAccess === true,
    };
}


export function getNewestCompatibleRelease(payload: unknown, currentVersion: string, settings: RuntimeSettings): Release | undefined {
    if (!Array.isArray(payload))
        return undefined;

    const candidates = payload.filter(supportedRelease)
        .filter((item) => !item.draft
            && hasSupportedVersion(item)
            && (!item.prerelease || updatePreferences(settings, currentVersion).includePrereleases)
            && item.assets.some((asset) => asset.name === "RELEASES")
            && item.assets.some((asset) => /-full\.nupkg$/i.test(asset.name))
        );

    return candidates.sort((first, second) => isNewerThan(first.tag_name, second.tag_name) ? -1 : 1).find((item) => isNewerThan(item.tag_name, currentVersion));
}


export function getAvailableUpdateState(release: Release, currentVersion: string, settings: RuntimeSettings): Extract<DesktopUpdateState, { kind: "available" | "downloading" | "ready" }> {
    const match = releaseVersion.exec(release.tag_name)!;
    return {
        kind: "available",
        currentVersion,
        version: match[0].slice(1),
        title: typeof release.name === "string" && release.name ? release.name : `Skladno ${match[0]}`,
        summary: typeof release.body === "string" ? release.body.replace(/<[^>]*>/g, "").trim().slice(0, 1000) : "",
        releaseNotesUrl: release.html_url,
        security: match[5] === ".security",
        ...(settings.lastUpdateCheckAt ? { lastCheckedAt: settings.lastUpdateCheckAt } : {}),
        ...updatePreferences(settings, currentVersion),
    };
}
