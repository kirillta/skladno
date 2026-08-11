import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
    plugins: [
        react(),
        tailwindcss(),
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
