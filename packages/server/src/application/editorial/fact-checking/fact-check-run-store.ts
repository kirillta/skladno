export interface FactCheckRunStore {
    saveFactCheckRun(artifactId: string, articleId: string, revisionId: string): void;
}
