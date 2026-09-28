import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
    build: {
        rollupOptions: {
            input: {
                home: fileURLToPath(new URL("./index.html", import.meta.url)),
                plans: fileURLToPath(new URL("./plans.html", import.meta.url)),
            },
        },
    },
});
