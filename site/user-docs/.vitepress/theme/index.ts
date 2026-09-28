import DefaultTheme from "vitepress/theme";
import "./custom.css";

export default {
    extends: DefaultTheme,
    enhanceApp() {
        if (typeof document === "undefined")
            return;

        const root = document.documentElement;
        const syncColorScheme = () => {
            root.dataset.theme = root.classList.contains("dark") ? "dark" : "light";
        };

        syncColorScheme();
        new MutationObserver(syncColorScheme).observe(root, {
            attributes: true,
            attributeFilter: ["class"],
        });
    },
};
