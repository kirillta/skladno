import { describe, expect, it } from "vitest";
import { installedLocaleCatalogs } from "./catalogs.js";
import { validateCatalog } from "./catalog-validation.js";
import { en } from "./locales/en.js";
import { messages } from "./messages.js";

// product: cross-cutting.complete-catalog-required
describe("locale catalogs", () => {
    it("validates the complete English catalog and installed registry", () => {
        expect(Object.keys(en).sort()).toEqual(Object.keys(messages).sort());
        expect(() => validateCatalog(en)).not.toThrow();
        expect(installedLocaleCatalogs).toHaveLength(1);
    });

    it("rejects an incomplete catalog", () => {
        const incomplete = { ...en } as Record<string, string>;
        delete incomplete["errors.generic"];

        expect(() => validateCatalog(incomplete)).toThrow("exactly");
    });

    it("uses ICU plural rules for revision counts", () => {
        expect(messages["revisions.count"]).toContain("plural");
        expect(() => validateCatalog(en)).not.toThrow();
    });
});
