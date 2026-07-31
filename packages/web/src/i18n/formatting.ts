import type { DateFormatPreference, TimeFormatPreference } from "@skladno/shared";

export function dateTimeOptions(dateFormat: DateFormatPreference, timeFormat: TimeFormatPreference): Intl.DateTimeFormatOptions {
    const date = dateFormat === "system" ? {} : dateFormat === "iso"
        ? { year: "numeric", month: "2-digit", day: "2-digit" } as const
        : { year: "2-digit", month: "2-digit", day: "2-digit" } as const;
    const hourCycle = timeFormat === "12-hour" ? "h12" : timeFormat === "24-hour" ? "h23" : undefined;

    return { ...date, hour: "2-digit", minute: "2-digit", ...(hourCycle ? { hourCycle } : {}) };
}

export function formatDateTime(value: string | Date, locale: string, dateFormat: DateFormatPreference = "system", timeFormat: TimeFormatPreference = "system", timeZone = "UTC"): string {
    return new Intl.DateTimeFormat(locale, { ...dateTimeOptions(dateFormat, timeFormat), timeZone }).format(new Date(value));
}
