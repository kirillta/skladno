import { defineConfig } from "vitepress";

export default defineConfig({
    title: "Skladno user guide",
    description: "Installation, user guides, settings, and reference for Skladno.",
    base: "/docs/",
    outDir: "../public/docs",
    themeConfig: {
        nav: [
            { text: "Guide index", link: "/" },
            { text: "Skladno", link: "../" },
        ],
        sidebar: [
            {
                text: "Installation",
                items: [
                    { text: "Install Skladno", link: "/installation" },
                ],
            },
            {
                text: "Guides",
                items: [
                    { text: "Overview", link: "/" },
                    { text: "Editorial Assistant", link: "/editorial-assistant" },
                    { text: "Skills", link: "/skills" },
                ],
            },
            {
                text: "Settings",
                items: [
                    { text: "AI providers and models", link: "/providers" },
                    { text: "AI provider costs", link: "/provider-costs" },
                    { text: "Backups and recovery", link: "/backups-and-recovery" },
                    { text: "Update recovery", link: "/update-recovery" },
                    { text: "Diagnostic and usage data", link: "/telemetry" },
                ],
            },
            {
                text: "Reference",
                items: [
                    { text: "Glossary", link: "/glossary" },
                ],
            },
        ],
    },
    appearance: true,
});
