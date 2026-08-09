import type { AcceptedChange, AcceptProposalInput, Article, ArticleDraft, ArticleRevision, CreateArticleInput, SaveArticleDraftInput, SaveArticleRevisionInput, UpdateArticleInput } from "@skladno/shared";


export interface ArticleStore {
    listArticles(): Article[];
    createArticle(input: CreateArticleInput): Article;
    getArticle(articleId: string): Article | undefined;
    updateArticle(articleId: string, input: UpdateArticleInput): Article;
    deleteArticle(articleId: string): void;
    saveArticleDraft(articleId: string, input: SaveArticleDraftInput): ArticleDraft;
    discardArticleDraft(articleId: string, expectedDraftVersion: number): void;
    saveArticleRevision(articleId: string, input: SaveArticleRevisionInput): ArticleRevision;
    listArticleRevisions(articleId: string): ArticleRevision[];
    acceptChange(articleId: string, change: AcceptedChange): ArticleRevision;
    acceptProposal(articleId: string, input: AcceptProposalInput): ArticleRevision;
    restoreRevision(articleId: string, revisionId: string): ArticleRevision;
}
