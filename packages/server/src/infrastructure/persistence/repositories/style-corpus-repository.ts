import type { CreateStyleCorpusItemInput, StyleCorpus, StyleCorpusItem, StyleProfile, StyleTrait } from "@skladno/shared";

import type { SqliteDatabase } from "../database.js";
import { createId, now, required, type Row } from "./repository-utils.js";


function profileFor(items: { id: string; content: string }[], rules: string, version: number): StyleProfile {
    const content = items.map((item) => item.content).join("\n");
    const sentences = content.split(/[.!?]+/).map((sentence) => sentence.trim()).filter(Boolean);
    const words = content.match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)?/gu) ?? [];
    const paragraphs = content.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
    const averageSentenceWords = sentences.length === 0 ? 0 : words.length / sentences.length;
    const firstPerson = (content.match(/\b(I|we|my|our|I’m|we’re|I’ve|we’ve)\b/giu) ?? []).length;
    const contractions = (content.match(/\b[\p{L}]+['’][\p{L}]+\b/gu) ?? []).length;
    const traits: StyleTrait[] = [{
        id: "voice",
        label: firstPerson > 0 ? "personal author presence" : "impersonal explanatory voice",
        evidence: `${firstPerson} first-person references in the local corpus.`
    }, {
        id: "rhythm",
        label: averageSentenceWords <= 14 ? "compact sentences" : averageSentenceWords >= 24 ? "long, developed sentences" : "moderate sentence length",
        evidence: `Average sentence length: ${Math.round(averageSentenceWords)} words across ${sentences.length} sentences.`
    }, {
        id: "structure",
        label: paragraphs.length >= 4 && paragraphs.length / Math.max(sentences.length, 1) >= .2 ? "frequent paragraph breaks" : "developed paragraphs",
        evidence: `${paragraphs.length} paragraphs across ${sentences.length} sentences.`
    }, {
        id: "vocabulary",
        label: contractions > 0 ? "conversational contractions" : "formal, expanded phrasing",
        evidence: `${contractions} contractions in the local corpus.`
    }];
    const characterCount = content.length;

    return {
        version,
        corpusItemCount: items.length,
        characterCount,
        confidence: items.length >= 5 && characterCount >= 12_000 ? "high" : items.length >= 2 && characterCount >= 3_000 ? "medium" : "low",
        traits,
        phrasesToAvoid: [],
        contributorIds: items.map((item) => item.id),
        rules,
        updatedAt: now()
    };
}


function excerpt(content: string): string {
    const compact = content.trim().replace(/\s+/g, " ");
    return compact.length <= 180 ? compact : `${compact.slice(0, 177)}…`;
}


export class StyleCorpusRepository {
    constructor(private readonly database: SqliteDatabase) { }


    get(): StyleCorpus {
        const rows = this.database.prepare("SELECT author_materials.*, style_corpus_items.included, style_corpus_items.origin, style_corpus_items.article_id, style_corpus_items.revision_id FROM style_corpus_items JOIN author_materials ON author_materials.id = style_corpus_items.author_material_id ORDER BY style_corpus_items.created_at, author_materials.id").all() as Row[];
        const rules = String((this.database.prepare("SELECT rules FROM style_corpus_settings WHERE id = 1").get() as Row | undefined)?.rules ?? "");
        const profileRow = this.database.prepare("SELECT profile_json FROM style_profile_versions ORDER BY version DESC LIMIT 1").get() as Row | undefined;
        const profile = profileRow ? JSON.parse(String(profileRow.profile_json)) as StyleProfile : undefined;
        const includedIds = rows.filter((row) => Number(row.included) === 1).map((row) => String(row.id));
        const status = includedIds.length === 0 ? "empty" : profile && profile.rules === rules && profile.contributorIds.length === includedIds.length && profile.contributorIds.every((id) => includedIds.includes(id)) ? "ready" : "outdated";

        return {
            items: rows.map((row): StyleCorpusItem => ({
                id: String(row.id),
                name: String(row.name),
                characterCount: String(row.content).length,
                wordCount: String(row.content).match(/[\p{L}\p{N}]+/gu)?.length ?? 0,
                excerpt: excerpt(String(row.content)),
                createdAt: String(row.created_at),
                updatedAt: String(row.updated_at),
                included: Number(row.included) === 1,
                origin: String(row.origin) as StyleCorpusItem["origin"],
                ...(row.article_id ? { articleId: String(row.article_id) } : {}),
                ...(row.revision_id ? { revisionId: String(row.revision_id) } : {})
            })),
            ...(profile ? { profile } : {}), rules, status
        };
    }


    add(input: CreateStyleCorpusItemInput & { name: string }): StyleCorpus {
        const timestamp = now();
        const materialId = createId();
        this.database.prepare("INSERT INTO author_materials (id, name, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(materialId, required(input.name, "Corpus item name"), required(input.content, "Corpus item content"), timestamp, timestamp);
        this.database.prepare("INSERT INTO style_corpus_items (author_material_id, created_at, origin) VALUES (?, ?, ?)").run(materialId, timestamp, input.origin ?? "manual");

        return this.get();
    }


    setIncluded(id: string, included: boolean): StyleCorpus {
        if (this.database.prepare("UPDATE style_corpus_items SET included = ? WHERE author_material_id = ?").run(included ? 1 : 0, id).changes === 0)
            throw new Error("Style corpus item not found.");

        return this.get();
    }


    setRules(rules: string): StyleCorpus {
        this.database.prepare("UPDATE style_corpus_settings SET rules = ?, updated_at = ? WHERE id = 1").run(rules, now());
        return this.get();
    }


    rebuild(): StyleCorpus {
        const rows = this.database.prepare("SELECT author_materials.id, author_materials.content FROM style_corpus_items JOIN author_materials ON author_materials.id = style_corpus_items.author_material_id WHERE style_corpus_items.included = 1 ORDER BY style_corpus_items.created_at, author_materials.id").all() as Row[];
        if (!rows.length)
            throw new Error("Include at least one style corpus item before rebuilding.");

        const rules = String((this.database.prepare("SELECT rules FROM style_corpus_settings WHERE id = 1").get() as Row).rules);
        const version = Number((this.database.prepare("SELECT COALESCE(MAX(version), 0) + 1 AS version FROM style_profile_versions").get() as Row).version);
        const profile = profileFor(rows.map((row) => ({ id: String(row.id), content: String(row.content) })), rules, version);
        this.database.prepare("INSERT INTO style_profile_versions (version, profile_json, created_at) VALUES (?, ?, ?)").run(version, JSON.stringify(profile), profile.updatedAt);

        return this.get();
    }


    getArticleRules(articleId: string): string {
        const row = this.database
            .prepare("SELECT rules FROM article_style_rules WHERE article_id = ?")
            .get(articleId) as Row | undefined;

        return row ? String(row.rules) : "";
    }


    setArticleRules(articleId: string, rules: string): string {
        this.database.prepare("INSERT INTO article_style_rules (article_id, rules, updated_at) VALUES (?, ?, ?) ON CONFLICT(article_id) DO UPDATE SET rules = excluded.rules, updated_at = excluded.updated_at")
            .run(articleId, rules, now());

        return rules;
    }


    remove(id: string): void {
        if (this.database.prepare("DELETE FROM style_corpus_items WHERE author_material_id = ?").run(id).changes === 0)
            throw new Error("Style corpus item not found.");

        this.database.prepare("DELETE FROM author_materials WHERE id = ?").run(id);
    }
}
