export const publishSettingsPath = "/api/settings/publish-limit-profile";

export const PUBLISH_LIMIT_PROFILE = {
    DEFAULT: "default",
    LINKEDIN_POST: "linkedin-post",
    LINKEDIN_ARTICLE: "linkedin-article",
    NO_RESTRICTIONS: "no-restrictions",
    CUSTOM: "custom",
} as const;

export type PublishLimitProfileId = typeof PUBLISH_LIMIT_PROFILE[keyof typeof PUBLISH_LIMIT_PROFILE];


export interface PublishLimitProfile {
    id: PublishLimitProfileId;
    characterLimit?: number;
    warningThreshold?: number;
}


export const publishLimitProfiles: readonly PublishLimitProfile[] = [
    {
        id: PUBLISH_LIMIT_PROFILE.NO_RESTRICTIONS,
    },
    {
        id: PUBLISH_LIMIT_PROFILE.DEFAULT,
        characterLimit: 3_000,
        warningThreshold: 2_700,
    },
    {
        id: PUBLISH_LIMIT_PROFILE.LINKEDIN_POST,
        characterLimit: 3_000,
        warningThreshold: 2_700,
    },
    {
        id: PUBLISH_LIMIT_PROFILE.LINKEDIN_ARTICLE,
        characterLimit: 125_000,
        warningThreshold: 112_500,
    },
    { id: PUBLISH_LIMIT_PROFILE.CUSTOM },
];

export const defaultPublishLimitProfileId = PUBLISH_LIMIT_PROFILE.DEFAULT;


export interface PublishingSettings {
    defaultProfileId: PublishLimitProfileId;
    customProfile: { name: string; characterLimit: number };
}


export const defaultPublishingSettings: PublishingSettings = {
    defaultProfileId: defaultPublishLimitProfileId,
    customProfile: { name: "Custom", characterLimit: 3_000 },
};


export function isPublishLimitProfileId(value: unknown): value is PublishLimitProfileId {
    return publishLimitProfiles.some((profile) => profile.id === value);
}


export function getPublishLimitProfile(id: PublishLimitProfileId, settings = defaultPublishingSettings): PublishLimitProfile {
    return id === PUBLISH_LIMIT_PROFILE.CUSTOM
        ? { id, characterLimit: settings.customProfile.characterLimit, warningThreshold: Math.floor(settings.customProfile.characterLimit * .9) }
        : publishLimitProfiles.find((profile) => profile.id === id) ?? publishLimitProfiles.find((profile) => profile.id === PUBLISH_LIMIT_PROFILE.DEFAULT)!;
}


export function preparePlainTextForPublishing(content: string): string {
    return content
        .replace(/\r\n?/g, "\n")
        .replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+[^)]*)?\)/g, "$1 ($2)")
        .replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+[^)]*)?\)/g, "$1 ($2)")
        .replace(/<((?:https?:\/\/|mailto:)[^>]+)>/g, "$1")
        .replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, "")
        .replace(/^[ \t]{0,3}>[ \t]?/gm, "")
        .replace(/^[ \t]*(?:[-+*]|\d+[.)])[ \t]+/gm, "")
        .replace(/^[ \t]{0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/gm, "")
        .replace(/^[ \t]*```[^\n]*\n?/gm, "")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/```/g, "")
        .replace(/\\\n/g, "\n")
        .replace(/(\*\*|__)(.+?)\1/g, "$2")
        .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "$1")
        .replace(/(?<!_)_([^_\n]+)_(?!_)/g, "$1")
        .replace(/~~(.+?)~~/g, "$1")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}


export function countPublishingCharacters(content: string): number {
    return Array.from(content).length;
}


export type PublishingLengthState = "within-limit" | "near-limit" | "over-limit";


export interface PublishingLength {
    count: number;
    remaining?: number;
    state: PublishingLengthState;
}


/** Resolves advisory publishing guidance without restricting any Article action. */
export function getPublishingLength(content: string, profile: PublishLimitProfile): PublishingLength {
    const count = countPublishingCharacters(content);
    if (profile.characterLimit === undefined)
        return { count, state: "within-limit" };

    const remaining = profile.characterLimit - count;

    return {
        count,
        remaining,
        state: remaining < 0
            ? "over-limit"
            : count >= (profile.warningThreshold ?? profile.characterLimit)
                ? "near-limit"
                : "within-limit",
    };
}


export interface PublishingClient {
    getPublishingSettings(): Promise<PublishingSettings>;
    setPublishingSettings(settings: PublishingSettings): Promise<PublishingSettings>;
}
