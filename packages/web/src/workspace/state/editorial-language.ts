export function targetLanguageId(language: string): string {
    return ({ English: "en", Spanish: "es", Portuguese: "pt", Russian: "ru", French: "fr", German: "de", Italian: "it" } as Record<string, string>)[language] ?? "en";
}


export function providerLanguageName(languageId: string): string {
    return ({ en: "English", es: "Spanish", pt: "Portuguese", ru: "Russian", fr: "French", de: "German", it: "Italian" } as Record<string, string>)[languageId] ?? languageId;
}
