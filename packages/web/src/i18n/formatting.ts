import { isTimeZonePreference, type DateFormatPreference, type TimeFormatPreference, type TimeZonePreference } from "@skladno/shared";

export function dateTimeOptions(dateFormat: DateFormatPreference, timeFormat: TimeFormatPreference): Intl.DateTimeFormatOptions {
    const date = dateFormat === "system" ? {} : dateFormat === "iso"
        ? { year: "numeric", month: "2-digit", day: "2-digit" } as const
        : { year: "2-digit", month: "2-digit", day: "2-digit" } as const;
    const hourCycle = timeFormat === "12-hour" ? "h12" : timeFormat === "24-hour" ? "h23" : undefined;

    return { ...date, hour: "2-digit", minute: "2-digit", ...(hourCycle ? { hourCycle } : {}) };
}

export function systemTimeZone(): string | undefined {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
}


export function resolveTimeZone(timeZone: TimeZonePreference = "system"): string | undefined {
    return timeZone === "system" ? systemTimeZone() : timeZone;
}


function timeZoneOffset(timeZone: string, date: Date): string {
    const name = new Intl.DateTimeFormat("en", {
        timeZone,
        timeZoneName: "longOffset",
    }).formatToParts(date).find((part) => part.type === "timeZoneName")?.value;
    const match = /^GMT(?:(?<sign>[+-])(?<hours>\d{1,2})(?::(?<minutes>\d{2}))?)?$/.exec(name ?? "");

    if (!match)
        return "UTC+00:00";

    return `UTC${match.groups?.sign ?? "+"}${(match.groups?.hours ?? "00").padStart(2, "0")}:${match.groups?.minutes ?? "00"}`;
}


function timeZoneCity(timeZone: string): string {
    if (timeZone === "UTC")
        return "Coordinated Universal Time";

    return timeZone.split("/").at(-1)?.replaceAll("_", " ") ?? timeZone;
}


export function formatTimeZoneLabel(timeZone: string, date = new Date()): string {
    return `(${timeZoneOffset(timeZone, date)}) ${timeZoneCity(timeZone)}`;
}


export interface TimeZoneOption {
    value: string;
    label: string;
}


export function timeZoneOptions(selectedTimeZone: TimeZonePreference = "system", date = new Date()): TimeZoneOption[] {
    const supported = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
    const required = ["UTC", systemTimeZone(), selectedTimeZone === "system" ? undefined : selectedTimeZone]
        .filter((value): value is string => Boolean(value) && isTimeZonePreference(value));

    return [...new Set([...required, ...supported])]
        .map((value) => ({
            value,
            label: formatTimeZoneLabel(value, date),
        }))
        .sort((left, right) => left.label.localeCompare(right.label));
}


export function formatDateTime(value: string | Date, locale: string, dateFormat: DateFormatPreference = "system", timeFormat: TimeFormatPreference = "system", timeZone: TimeZonePreference = "system"): string {
    const resolvedTimeZone = resolveTimeZone(timeZone);

    return new Intl.DateTimeFormat(locale, {
        ...dateTimeOptions(dateFormat, timeFormat),
        ...(resolvedTimeZone ? { timeZone: resolvedTimeZone } : {}),
    }).format(new Date(value));
}
