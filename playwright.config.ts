import { defineConfig } from "@playwright/test";

export default defineConfig({
    testDir: "./e2e",
    fullyParallel: false,
    preserveOutput: "never",
    reporter: "line",
    use: {
        baseURL: "http://127.0.0.1:5173",
        screenshot: "off",
        trace: "off",
        video: "off",
    },
    webServer: [
        {
            command: "tsx packages/server/src/test-support/e2e-service.ts",
            url: "http://127.0.0.1:8787/api/health",
            reuseExistingServer: false,
            env: {
                SKLADNO_DATA_DIR: ".e2e-data",
                SKLADNO_SERVER_HOST: "127.0.0.1",
                SKLADNO_SERVER_PORT: "8787",
                SKLADNO_WEB_ORIGIN: "http://127.0.0.1:5173",
            },
        },
        {
            command: "npm run dev --workspace @skladno/web -- --host 127.0.0.1",
            url: "http://127.0.0.1:5173",
            reuseExistingServer: false,
        },
    ],
});
