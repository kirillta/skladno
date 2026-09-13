import type { Article } from "@skladno/shared";

import type { SqliteDatabase } from "../database.js";
import { articleNotFound, invalidArticleRequest } from "./article-repository-errors.js";


type FindArticle = (articleId: string) => Article | undefined;


function transaction<T>(database: SqliteDatabase, operation: () => T): T {
    database.exec("BEGIN IMMEDIATE;");
    try {
        const result = operation();
        database.exec("COMMIT;");

        return result;
    } catch (error) {
        database.exec("ROLLBACK;");
        throw error;
    }
}


export function deleteArticle(database: SqliteDatabase, articleId: string, findArticle: FindArticle): void {
    transaction(database, () => {
        const current = findArticle(articleId);
        if (!current)
            articleNotFound();

        if (current.sourceArticleId)
            database.prepare("DELETE FROM articles WHERE id = ?").run(articleId);
        else
            database.prepare("DELETE FROM articles WHERE id = ? OR source_article_id = ?").run(articleId, articleId);
    });
}


export function setArticleArchived(database: SqliteDatabase, articleId: string, archived: boolean, findArticle: FindArticle, listArticles: () => Article[]): Article[] {
    const rootId = transaction(database, () => {
        const current = findArticle(articleId);
        if (!current)
            articleNotFound();

        const rootId = current.sourceArticleId ?? current.id;
        database.prepare("UPDATE articles SET archived = ? WHERE id = ? OR source_article_id = ?").run(Number(archived), rootId, rootId);

        return rootId;
    });

    return listArticles().filter((article) => article.id === rootId || article.sourceArticleId === rootId);
}


export function setArticlePinned(database: SqliteDatabase, articleId: string, pinned: boolean, findArticle: FindArticle): Article {
    const current = findArticle(articleId);
    if (!current)
        articleNotFound();

    if (current.sourceArticleId || current.archived)
        invalidArticleRequest();

    const pinOrder = pinned
        ? Number(database.prepare("SELECT COALESCE(MIN(pin_order), 0) - 1 pin_order FROM articles WHERE source_article_id IS NULL AND pin_order IS NOT NULL").get()?.pin_order)
        : null;
    database.prepare("UPDATE articles SET pin_order = ? WHERE id = ?").run(pinOrder, articleId);

    return findArticle(articleId)!;
}


export function reorderPinnedArticles(database: SqliteDatabase, articleIds: string[], listArticles: () => Article[]): Article[] {
    const pinned = database.prepare("SELECT id FROM articles WHERE source_article_id IS NULL AND archived = 0 AND pin_order IS NOT NULL ORDER BY pin_order, id").all().map((row) => String(row.id));
    if (articleIds.length !== pinned.length || new Set(articleIds).size !== articleIds.length || articleIds.some((id) => !pinned.includes(id)))
        invalidArticleRequest();

    transaction(database, () => {
        const update = database.prepare("UPDATE articles SET pin_order = ? WHERE id = ?");
        articleIds.forEach((id, index) => update.run(index, id));
    });

    return listArticles();
}
