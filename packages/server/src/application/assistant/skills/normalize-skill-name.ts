/** Produces the stable comparison key used for Skill-name reservations. */
export function normalizeSkillName(name: string): string {
    return name.normalize("NFKC").toLowerCase();
}
