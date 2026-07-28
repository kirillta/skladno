import type { AppSetting } from "@skladno/shared";

import type { SqliteDatabase } from "../database.js";
import { now, required, type Row } from "./repository-utils.js";


export class SettingsRepository {
    constructor(private readonly database: SqliteDatabase) { }

    set(key: string, value: unknown): AppSetting {
        required(key, "Setting key");
        const updatedAt = now();
        this.database.prepare("INSERT INTO app_settings (key, value_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at")
            .run(key, JSON.stringify(value), updatedAt);

        return { key, value, updatedAt };
    }

    get(key: string): AppSetting | undefined {
        const row = this.database.prepare("SELECT * FROM app_settings WHERE key = ?").get(key) as Row | undefined;
        return row && { 
            key: String(row.key), 
            value: JSON.parse(String(row.value_json)), 
            updatedAt: String(row.updated_at) 
        };
    }
}
