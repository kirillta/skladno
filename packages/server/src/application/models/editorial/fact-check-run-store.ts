export interface FactCheckRunStore {
    save(artifactId: string, articleId: string, revisionId: string): void;
}
