import { describe, expect, it } from "vitest";
import { configureSystemDateTimeFormat, formatDate, formatDateTime, formatTime, formatTimeZoneLabel, resolveTimeZone, systemLocale, systemTimeZone, timeZoneOptions } from "./formatting.js";


describe("date and time formatting", () => {
    it("uses device locale and time zone for system preferences", () => {
        const value = "2026-01-01T15:45:00.000Z";
        const expected = new Intl.DateTimeFormat(systemLocale(), {
            year: "numeric",
            month: "numeric",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            ...(systemTimeZone() ? { timeZone: systemTimeZone() } : {}),
        }).format(new Date(value));

        expect(resolveTimeZone("system")).toBe(systemTimeZone());
        expect(formatDateTime(value, "en", "system", "system", "system")).toBe(expected);
    });


    it("formats each explicit date preference exactly", () => {
        const value = "2026-01-02T15:45:00.000Z";

        expect(formatDate(value, "day-first", "UTC")).toBe("02/01/2026");
        expect(formatDate(value, "day-first-dots", "UTC")).toBe("02.01.2026");
        expect(formatDate(value, "month-first", "UTC")).toBe("01/02/2026");
        expect(formatDate(value, "iso", "UTC")).toBe("2026-01-02");
    });


    it("honors Windows system date and time patterns when supplied by the local service", () => {
        configureSystemDateTimeFormat({
            locale: "ru-RU",
            datePattern: "dd.MM.yyyy",
            timePattern: "H:mm:ss",
        });

        expect(formatDateTime("2026-08-03T00:31:32.000Z", "en", "system", "system", "UTC")).toBe("03.08.2026, 0:31:32");

        configureSystemDateTimeFormat(undefined);
    });


    it("keeps date and time preferences independent", () => {
        const value = "2026-01-02T15:45:00.000Z";

        expect(formatDateTime(value, "en", "day-first-dots", "24-hour", "UTC")).toBe("02.01.2026, 15:45");
        expect(formatTime(value, "en", "12-hour", "UTC")).toContain("03:45");
        expect(formatTime(value, "en", "12-hour", "UTC")).toMatch(/PM/);
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
