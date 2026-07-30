import { Button, EmptyState } from "../../ui/primitives.js";
import type { ArticleRevisionsState, ArticleWorkspaceState, EditorialProposalState, PublishingState, StyleCorpusState, WorkspaceLayoutState } from "../EditorialWorkspace.js";
import { ArticleHeader } from "./ArticleHeader.js";
import { ArticleStatusBar } from "./ArticleStatusBar.js";
import { WorkspaceTabBar } from "./WorkspaceTabBar.js";
import { WorkspaceViewRouter } from "./WorkspaceViewRouter.js";

export function ArticleWorkspace({ workspace, layout, editorial, revisions, corpus, publishing, createBlank }: {
    workspace: ArticleWorkspaceState;
    layout: WorkspaceLayoutState;
    editorial: EditorialProposalState;
    revisions: ArticleRevisionsState;
    corpus: StyleCorpusState;
    publishing: PublishingState;
    createBlank: () => Promise<unknown>
}) {
    const article = workspace.selectedArticle;

    if (!article)
        return <EmptyState title="No articles yet" className="pt-40">
            <Button onClick={() => void createBlank()}>Create</Button>
        </EmptyState>;

    return <>
        <ArticleHeader article={article} save={workspace.save} remove={workspace.remove} focusMode={layout.focusMode} setFocusMode={layout.setFocusMode} />
        <WorkspaceTabBar view={layout.view} setView={layout.setView} />
        <WorkspaceViewRouter view={layout.view} article={article} workspace={workspace} editorial={editorial} revisions={revisions} corpus={corpus} publishing={publishing} />
        <ArticleStatusBar saveState={workspace.saveState} />
    </>;
}
