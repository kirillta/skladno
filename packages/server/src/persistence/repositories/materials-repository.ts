import type { CreateMaterialInput, Material, UpdateMaterialInput } from "@skladno/shared";

import type { SqliteDatabase } from "../database.js";
import { createId, now, required, type Row } from "./repository-utils.js";


function material(row: Row): Material {
    return {
        id: String(row.id),
        name: String(row.name),
        content: String(row.content),
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
    };
}


export class MaterialsRepository {
    constructor(private readonly database: SqliteDatabase) { }

    create(input: CreateMaterialInput): Material {
        const timestamp = now();
        const materialId = input.id ?? createId();
        this.database.prepare("INSERT INTO materials (id, name, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
            .run(materialId, required(input.name, "Material name"), input.content, timestamp, timestamp);

        return this.get(materialId)!;
    }

    get(materialId: string): Material | undefined {
        const row = this.database.prepare("SELECT * FROM materials WHERE id = ?").get(materialId) as Row | undefined;
        return row && material(row);
    }


    list(): Material[] {
        return (this.database.prepare("SELECT * FROM materials ORDER BY created_at, id").all() as Row[]).map(material);
    }


    delete(materialId: string): void {
        const result = this.database.prepare("DELETE FROM materials WHERE id = ?").run(materialId);
        if (result.changes === 0)
            throw new Error("Material not found.");
    }

    update(materialId: string, input: UpdateMaterialInput): Material {
        const existing = this.get(materialId);
        if (!existing)
            throw new Error("Material not found.");
        
        if (input.name === undefined && input.content === undefined)
            return existing;

        this.database.prepare("UPDATE materials SET name = ?, content = ?, updated_at = ? WHERE id = ?")
            .run(input.name === undefined ? existing.name : required(input.name, "Material name"), input.content ?? existing.content, now(), materialId);

        return this.get(materialId)!;
    }
}
