import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
    base: "./",
    plugins: [
        react(),
        // Lightning CSS does not yet recognize the standard ::highlight() pseudo-element.
        tailwindcss({ optimize: false }),
    ],
    test: {
        environment: "jsdom",
    },
    resolve: {
        alias: {
            "@skladno/shared": fileURLToPath(new URL("../shared/src/index.ts", import.meta.url)),
        },
    },
    server: {
        port: 5173,
        strictPort: true,
    },
});
