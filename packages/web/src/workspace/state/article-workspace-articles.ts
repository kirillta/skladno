import type { Article } from "@skladno/shared";


function getArticleActivityTimestamp(article: Article): string {
    return article.draft && article.draft.updatedAt > article.updatedAt ? article.draft.updatedAt : article.updatedAt;
}


export function sortArticlesByActivity(articles: Article[]): Article[] {
    return [...articles].sort((first, second) => getArticleActivityTimestamp(second).localeCompare(getArticleActivityTimestamp(first)) || first.id.localeCompare(second.id));
}


export function withoutDraft(article: Article): Omit<Article, "draft"> {
    const { draft: _draft, ...result } = article;
    void _draft;
    return result;
}


export function getArticleContentForWorkspace(article: Article): string {
    return article.draft?.baseRevisionId === article.currentRevisionId ? article.draft.content : article.currentRevision.content;
}
