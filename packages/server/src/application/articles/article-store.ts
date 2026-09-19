import type { AcceptProposalInput, Article, ArticleDraft, ArticleRevision, CreateArticleInput, SaveArticleDraftInput, SaveArticleRevisionInput, UpdateArticleInput } from "@skladno/shared";


export interface ArticleStore {
    listArticles(): Article[];
    createArticle(input: CreateArticleInput): Article;
    getArticle(articleId: string): Article | undefined;
    updateArticle(articleId: string, input: UpdateArticleInput): Article;
    deleteArticle(articleId: string): void;
    setArticleArchived(articleId: string, archived: boolean): Article[];
    setArticlePinned(articleId: string, pinned: boolean): Article;
    reorderPinnedArticles(articleIds: string[]): Article[];
    saveDraft(articleId: string, input: SaveArticleDraftInput): ArticleDraft;
    discardDraft(articleId: string, expectedDraftVersion: number): void;
    saveRevision(articleId: string, input: SaveArticleRevisionInput, description?: string): ArticleRevision;
    listRevisions(articleId: string): ArticleRevision[];
    getRevision(articleId: string, revisionId: string): ArticleRevision | undefined;
    acceptProposal(articleId: string, input: AcceptProposalInput, description?: string): ArticleRevision;
    restoreRevision(articleId: string, revisionId: string): ArticleRevision;
    appendArticleRevision(articleId: string, content: string, provenance: Record<string, unknown>, restoredFromRevisionId?: string): ArticleRevision;
}
