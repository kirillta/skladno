export const publishSettingsPath = "/api/settings/publish-limit-profile";

export const PUBLISH_LIMIT_PROFILE = {
    LINKEDIN_SHORT: "linkedin-short",
    LINKEDIN_POST: "linkedin-post",
} as const;

export type PublishLimitProfileId = typeof PUBLISH_LIMIT_PROFILE[keyof typeof PUBLISH_LIMIT_PROFILE];

export interface PublishLimitProfile {
    id: PublishLimitProfileId;
    label: string;
    characterLimit: number;
    warningThreshold: number;
}

export const publishLimitProfiles: readonly PublishLimitProfile[] = [
    {
        id: PUBLISH_LIMIT_PROFILE.LINKEDIN_SHORT,
        label: "LinkedIn short post",
        characterLimit: 1_300,
        warningThreshold: 1_000,
    },
    {
        id: PUBLISH_LIMIT_PROFILE.LINKEDIN_POST,
        label: "LinkedIn post",
        characterLimit: 3_000,
        warningThreshold: 2_700,
    },
];

export const defaultPublishLimitProfileId = PUBLISH_LIMIT_PROFILE.LINKEDIN_POST;

export function isPublishLimitProfileId(value: unknown): value is PublishLimitProfileId {
    return publishLimitProfiles.some((profile) => profile.id === value);
}


export function getPublishLimitProfile(id: PublishLimitProfileId): PublishLimitProfile {
    return publishLimitProfiles.find((profile) => profile.id === id) ?? publishLimitProfiles[0]!;
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


export interface PublishingClient {
    getPublishLimitProfile(): Promise<PublishLimitProfileId>;
    setPublishLimitProfile(profileId: PublishLimitProfileId): Promise<PublishLimitProfileId>;
}
