import type { AcceptProposalInput, Article, ArticleDraft, ArticleRevision, CreateArticleInput, SaveArticleDraftInput, SaveArticleRevisionInput, UpdateArticleInput } from "@skladno/shared";


export interface ArticleStore {
    list(): Article[];
    create(input: CreateArticleInput): Article;
    get(articleId: string): Article | undefined;
    update(articleId: string, input: UpdateArticleInput): Article;
    delete(articleId: string): void;
    saveDraft(articleId: string, input: SaveArticleDraftInput): ArticleDraft;
    discardDraft(articleId: string, expectedDraftVersion: number): void;
    saveRevision(articleId: string, input: SaveArticleRevisionInput): ArticleRevision;
    listRevisions(articleId: string): ArticleRevision[];
    getRevision(articleId: string, revisionId: string): ArticleRevision | undefined;
    acceptProposal(articleId: string, input: AcceptProposalInput): ArticleRevision;
    restoreRevision(articleId: string, revisionId: string): ArticleRevision;
    appendRevision(articleId: string, content: string, provenance: Record<string, unknown>, restoredFromRevisionId?: string): ArticleRevision;
}


export interface AssistantGreetingStore {
    ensureGreeting(articleId: string): void;
}
