import { isTimeZonePreference, type DateFormatPreference, type SystemDateTimeFormat, type TimeFormatPreference, type TimeZonePreference } from "@skladno/shared";

let configuredSystemDateTimeFormat: SystemDateTimeFormat | undefined;


export function configureSystemDateTimeFormat(value: SystemDateTimeFormat | undefined): void {
    configuredSystemDateTimeFormat = value;
}


function timeOptions(timeFormat: TimeFormatPreference): Intl.DateTimeFormatOptions {
    let hourCycle: "h12" | "h23" | undefined;
    if (timeFormat === "12-hour") 
        hourCycle = "h12";
    else if (timeFormat === "24-hour") 
        hourCycle = "h23";

    return {
        hour: "2-digit",
        minute: "2-digit",
        ...(hourCycle ? { hourCycle } : {}),
    };
}


export function systemLocale(): string {
    return configuredSystemDateTimeFormat?.locale || Intl.DateTimeFormat().resolvedOptions().locale;
}


export function systemTimeZone(): string | undefined {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
}


export function resolveTimeZone(timeZone: TimeZonePreference = "system"): string | undefined {
    return timeZone === "system" ? systemTimeZone() : timeZone;
}


function dateParts(value: string | Date, timeZone: TimeZonePreference): Record<"year" | "month" | "day", string> {
    const resolvedTimeZone = resolveTimeZone(timeZone);
    const parts = new Intl.DateTimeFormat("en", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        ...(resolvedTimeZone ? { timeZone: resolvedTimeZone } : {}),
    }).formatToParts(new Date(value));

    return Object.fromEntries(parts
        .filter((part): part is Intl.DateTimeFormatPart & { type: "year" | "month" | "day" } => part.type === "year" || part.type === "month" || part.type === "day")
        .map((part) => [part.type, part.value])) as Record<"year" | "month" | "day", string>;
}


function numericDateParts(value: string | Date, timeZone: TimeZonePreference): Record<"year" | "month" | "day", number> {
    return Object.fromEntries(Object.entries(dateParts(value, timeZone)).map(([key, part]) => [key, Number(part)])) as Record<"year" | "month" | "day", number>;
}


function systemDate(value: string | Date, timeZone: TimeZonePreference): string {
    const pattern = configuredSystemDateTimeFormat?.datePattern;
    const resolvedTimeZone = resolveTimeZone(timeZone);
    if (!pattern)
        return new Intl.DateTimeFormat(systemLocale(), {
            year: "numeric",
            month: "numeric",
            day: "numeric",
            ...(resolvedTimeZone ? { timeZone: resolvedTimeZone } : {}),
        }).format(new Date(value));

    const { year, month, day } = numericDateParts(value, timeZone);
    return pattern
        .replace(/yyyy/g, String(year).padStart(4, "0"))
        .replace(/yy/g, String(year % 100).padStart(2, "0"))
        .replace(/dd/g, String(day).padStart(2, "0"))
        .replace(/d/g, String(day))
        .replace(/MM/g, String(month).padStart(2, "0"))
        .replace(/M/g, String(month));
}


export function formatDate(value: string | Date, dateFormat: DateFormatPreference = "system", timeZone: TimeZonePreference = "system"): string {
    if (dateFormat === "system")
        return systemDate(value, timeZone);

    const { year, month, day } = dateParts(value, timeZone);
    if (dateFormat === "day-first")
        return `${day}/${month}/${year}`;

    if (dateFormat === "day-first-dots")
        return `${day}.${month}.${year}`;

    if (dateFormat === "month-first")
        return `${month}/${day}/${year}`;

    return `${year}-${month}-${day}`;
}


function systemTime(value: string | Date, timeZone: TimeZonePreference): string {
    const pattern = configuredSystemDateTimeFormat?.timePattern;
    const resolvedTimeZone = resolveTimeZone(timeZone);
    if (!pattern)
        return new Intl.DateTimeFormat(systemLocale(), {
            ...timeOptions("system"),
            ...(resolvedTimeZone ? { timeZone: resolvedTimeZone } : {}),
        }).format(new Date(value));

    const parts = new Intl.DateTimeFormat("en", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
        ...(resolvedTimeZone ? { timeZone: resolvedTimeZone } : {}),
    }).formatToParts(new Date(value));
    const valueByType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const hour = Number(valueByType.hour);
    const twelveHour = hour % 12 || 12;
    const dayPeriod = hour < 12 ? "AM" : "PM";

    return pattern
        .replace(/HH/g, String(hour).padStart(2, "0"))
        .replace(/H/g, String(hour))
        .replace(/hh/g, String(twelveHour).padStart(2, "0"))
        .replace(/h/g, String(twelveHour))
        .replace(/mm/g, valueByType.minute ?? "00")
        .replace(/m/g, String(Number(valueByType.minute ?? "0")))
        .replace(/ss/g, valueByType.second ?? "00")
        .replace(/s/g, String(Number(valueByType.second ?? "0")))
        .replace(/tt/g, dayPeriod)
        .replace(/t/g, dayPeriod.slice(0, 1));
}


export function formatTime(value: string | Date, locale: string, timeFormat: TimeFormatPreference = "system", timeZone: TimeZonePreference = "system"): string {
    const resolvedTimeZone = resolveTimeZone(timeZone);
    if (timeFormat === "system")
        return systemTime(value, timeZone);

    return new Intl.DateTimeFormat(locale, {
        ...timeOptions(timeFormat),
        ...(resolvedTimeZone ? { timeZone: resolvedTimeZone } : {}),
    }).format(new Date(value));
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
    return `${formatDate(value, dateFormat, timeZone)}, ${formatTime(value, locale, timeFormat, timeZone)}`;
}
