import { describe, expect, it } from "vitest";
import { formatDateTime, formatTimeZoneLabel, resolveTimeZone, systemTimeZone, timeZoneOptions } from "./formatting.js";


describe("time-zone formatting", () => {
    it("uses the device time zone for the system preference", () => {
        const value = "2026-01-01T15:45:00.000Z";
        const expected = new Intl.DateTimeFormat("en", {
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23",
            ...(systemTimeZone() ? { timeZone: systemTimeZone() } : {}),
        }).format(new Date(value));

        expect(resolveTimeZone("system")).toBe(systemTimeZone());
        expect(formatDateTime(value, "en", "system", "24-hour", "system")).toBe(expected);
    });


    it("uses an explicit IANA zone and observes daylight-saving time", () => {
        expect(formatDateTime("2026-01-15T12:00:00.000Z", "en", "system", "24-hour", "America/New_York")).toContain("07:00");
        expect(formatDateTime("2026-07-15T12:00:00.000Z", "en", "system", "24-hour", "America/New_York")).toContain("08:00");
    });


    it("uses human-readable city names and current offsets in time-zone options", () => {
        const date = new Date("2026-01-15T12:00:00.000Z");
        const options = timeZoneOptions("America/Argentina/Buenos_Aires", date);

        expect(formatTimeZoneLabel("America/Argentina/Buenos_Aires", date)).toBe("(UTC-03:00) Buenos Aires");
        expect(formatTimeZoneLabel("America/New_York", date)).toBe("(UTC-05:00) New York");
        expect(options.map((option) => option.value)).toContain("UTC");
        expect(options.map((option) => option.value)).toContain("America/Argentina/Buenos_Aires");
        expect(new Set(options.map((option) => option.value)).size).toBe(options.length);
        if (systemTimeZone())
            expect(options.map((option) => option.value)).toContain(systemTimeZone());
    });
});
