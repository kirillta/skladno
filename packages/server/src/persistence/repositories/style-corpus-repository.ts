import type { CreateStyleCorpusItemInput, StyleCorpus, StyleCorpusItem, StyleProfile, StyleTrait } from "@skladno/shared";

import type { SqliteDatabase } from "../database.js";
import { createId, now, required, type Row } from "./repository-utils.js";


function profileFor(items: Array<{ content: string }>): StyleProfile | undefined {
    if (items.length === 0)
        return undefined;

    const content = items.map((item) => item.content).join("\n");
    const sentences = content.split(/[.!?]+/).map((sentence) => sentence.trim()).filter(Boolean);
    const words = content.match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)?/gu) ?? [];
    const paragraphs = content.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
    const averageSentenceWords = sentences.length === 0 ? 0 : words.length / sentences.length;
    const firstPerson = (content.match(/\b(I|we|my|our|I’m|we’re|I’ve|we’ve)\b/giu) ?? []).length;
    const contractions = (content.match(/\b[\p{L}]+['’][\p{L}]+\b/gu) ?? []).length;
    const traits: StyleTrait[] = [
        {
            id: "sentence-length",
            label: averageSentenceWords <= 14 ? "compact sentences" : averageSentenceWords >= 24 ? "long, developed sentences" : "moderate sentence length",
            evidence: `Average sentence length: ${Math.round(averageSentenceWords)} words across ${sentences.length} sentences.`,
        },
        {
            id: "paragraphing",
            label: paragraphs.length >= 4 && paragraphs.length / Math.max(sentences.length, 1) >= .2 ? "frequent paragraph breaks" : "developed paragraphs",
            evidence: `${paragraphs.length} paragraphs across ${sentences.length} sentences.`,
        },
        {
            id: "author-presence",
            label: firstPerson > 0 ? "personal author presence" : "impersonal explanatory voice",
            evidence: `${firstPerson} first-person references in the supplied corpus.`,
        },
        {
            id: "contractions",
            label: contractions > 0 ? "conversational contractions" : "formal, expanded phrasing",
            evidence: `${contractions} contractions in the supplied corpus.`,
        },
    ];
    const characterCount = content.length;
    const confidence = items.length >= 5 && characterCount >= 12_000 ? "high" : items.length >= 2 && characterCount >= 3_000 ? "medium" : "low";

    return { corpusItemCount: items.length, characterCount, confidence, traits, updatedAt: now() };
}


export class StyleCorpusRepository {
    constructor(private readonly database: SqliteDatabase) { }

    
    get(): StyleCorpus {
        const rows = this.database.prepare(`SELECT materials.* FROM style_corpus_items JOIN materials ON materials.id = style_corpus_items.material_id ORDER BY style_corpus_items.created_at, materials.id`).all() as Row[];
        const profile = profileFor(rows.map((row) => ({ content: String(row.content) })));
        const updatedAt = now();

        if (profile) {
            profile.updatedAt = updatedAt;
            this.database.prepare("INSERT INTO style_profiles (id, profile_json, updated_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET profile_json = excluded.profile_json, updated_at = excluded.updated_at")
                .run(JSON.stringify(profile), updatedAt);
        } else {
            this.database.prepare("DELETE FROM style_profiles WHERE id = 1").run();
        }

        return {
            items: rows.map((row): StyleCorpusItem => ({ 
                id: String(row.id), 
                name: String(row.name), 
                characterCount: String(row.content).length, 
                createdAt: String(row.created_at), 
                updatedAt: String(row.updated_at) 
            })),
            profile,
        };
    }


    add(input: CreateStyleCorpusItemInput): StyleCorpus {
        const timestamp = now();
        const materialId = createId();
        
        this.database.prepare("INSERT INTO materials (id, name, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
            .run(materialId, required(input.name, "Corpus item name"), input.content, timestamp, timestamp);
        this.database.prepare("INSERT INTO style_corpus_items (material_id, created_at) VALUES (?, ?)")
            .run(materialId, timestamp);
        
        return this.get();
    }


    remove(materialId: string): void {
        const result = this.database.prepare("DELETE FROM style_corpus_items WHERE material_id = ?").run(materialId);
        if (result.changes === 0)
            throw new Error("Style corpus item not found.");

        this.database.prepare("DELETE FROM materials WHERE id = ?")
            .run(materialId);
        this.get();
    }
}
