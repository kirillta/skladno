import { useEffect, useState, type ChangeEvent } from "react";
import { defaultGeneralSettings, type ArticleRevision, type GeneralSettings, type StyleCorpus, type StyleReview } from "@skladno/shared";
import { Banner, Button } from "../../ui/primitives.js";
import { useIntl } from "react-intl";
import type { MessageId } from "../../i18n/messages.js";
import { StyleProfileDialogs } from "./StyleProfileDialogs.js";
import { StyleProfileInsights } from "./StyleProfileInsights.js";
import { StyleProfileSources } from "./StyleProfileSources.js";


export function StyleProfileView({ corpus, findings, findingsStale, articleId, revisions = [], generalSettings = defaultGeneralSettings, add, remove, setIncluded, setRules, rebuild, getArticleRules, setArticleRules, snapshotArticleRevision = async () => undefined }: {
    corpus: StyleCorpus | undefined;
    findings: StyleReview | undefined;
    findingsStale: boolean;
    articleId: string;
    revisions?: readonly ArticleRevision[];
    generalSettings?: GeneralSettings;
    add: (name: string | undefined, content: string, origin?: "import") => Promise<void>;
    remove: (id: string) => Promise<void>;
    setIncluded: (id: string, included: boolean) => Promise<void>;
    setRules: (rules: string) => Promise<void>;
    rebuild: () => Promise<void>;
    getArticleRules: (articleId: string) => Promise<string>;
    setArticleRules: (articleId: string, rules: string) => Promise<string>;
    snapshotArticleRevision?: (articleId: string, revisionId: string) => Promise<void>;
}) {
    const intl = useIntl();
    const [name, setName] = useState("");
    const [content, setContent] = useState("");
    const [rules, setRulesDraft] = useState(corpus?.rules ?? "");
    const [savedRules, setSavedRules] = useState(corpus?.rules ?? "");
    const [rebuilt, setRebuilt] = useState(false);
    const [adding, setAdding] = useState(false);
    const [validationFailed, setValidationFailed] = useState(false);
    const [uploadFailed, setUploadFailed] = useState(false);
    const [articleRules, setArticleRulesDraft] = useState("");
    const [savedArticleRules, setSavedArticleRules] = useState("");
    const [pendingAction, setPendingAction] = useState<string>();
    const [removingId, setRemovingId] = useState<string>();
    const [snapshotRevisionId, setSnapshotRevisionId] = useState<string>();
    const activeCount = corpus?.items.filter((item) => item.included).length ?? 0;
    const selectableRevisions = revisions.map((revision, index) => ({ revision, number: index + 1 })).sort((left, right) => right.revision.createdAt.localeCompare(left.revision.createdAt));
    const summary = corpus?.profile
        ? intl.formatMessage({ id: "styleProfile.summary" }, { version: corpus.profile.version, confidence: corpus.profile.confidence })
        : intl.formatMessage({ id: "styleProfile.none" });
    const run = (action: string, operation: () => Promise<unknown>, onSuccess?: () => void) => {
        setPendingAction(action);
        void operation().then(() => onSuccess?.(), () => undefined).then(() => setPendingAction(undefined));
    };
    const submit = (origin?: "import") => {
        if (!content.trim()) {
            setValidationFailed(true);
            return;
        }

        run("add", () => add(name, content, origin), () => {
            setValidationFailed(false);
            setName("");
            setContent("");
            setAdding(false);
        });
    };
    const importFile = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file)
            return;

        if (!/\.(txt|md)$/i.test(file.name)) {
            setUploadFailed(true);
            event.target.value = "";
            return;
        }

        void file.text().then((text) => {
            setUploadFailed(false);
            setName(file.name.replace(/\.(txt|md)$/i, ""));
            setContent(text);
        }, () => setUploadFailed(true));
        event.target.value = "";
    };

    useEffect(() => {
        void getArticleRules(articleId).then((nextRules) => {
            setArticleRulesDraft(nextRules);
            setSavedArticleRules(nextRules);
        }, () => undefined);
    }, [articleId, getArticleRules]);

    useEffect(() => {
        const nextRules = corpus?.rules ?? "";
        setRulesDraft(nextRules);
        setSavedRules(nextRules);
    }, [corpus?.rules]);

    const ruleStatus = (draft: string, saved: string): MessageId => !draft.trim() ? "styleProfile.rulesNone" : draft === saved ? "styleProfile.rulesApplied" : "styleProfile.rulesUnsaved";
    const confirmRemove = () => {
        if (!removingId)
            return;

        const id = removingId;
        setRemovingId(undefined);
        run(`remove:${id}`, () => remove(id));
    };
    const confirmSnapshot = () => {
        if (!snapshotRevisionId)
            return;

        const revisionId = snapshotRevisionId;
        setSnapshotRevisionId(undefined);
        run(`snapshot:${revisionId}`, () => snapshotArticleRevision(articleId, revisionId));
    };

    return <div className="flex h-full min-h-0 max-w-[120rem] flex-col">
        <header className="mb-8 shrink-0 flex flex-wrap items-start justify-between gap-4">
            <div>
                <h2 className="text-base font-semibold">{intl.formatMessage({ id: "views.styleProfile" })}</h2>
                <p className="mt-1 text-xs text-muted">{summary} · {intl.formatMessage({ id: "styleProfile.activeSources" }, { count: activeCount })}{corpus?.status === "outdated" ? ` · ${intl.formatMessage({ id: "styleProfile.outdated" })}` : ""}</p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3">
                {rebuilt && <span className="text-xs text-success" role="status">{intl.formatMessage({ id: "styleProfile.rebuilt" }, { count: activeCount })}</span>}
                <Button variant="secondary" state={pendingAction === "rebuild" ? "loading" : "default"} disabled={corpus?.status === "empty" || Boolean(pendingAction)} onClick={() => run("rebuild", rebuild, () => setRebuilt(true))}>{intl.formatMessage({ id: "styleProfile.rebuild" })}</Button>
            </div>
        </header>
        {corpus?.profile?.confidence === "low" && <Banner className="mb-6" tone="warning">{intl.formatMessage({ id: "styleProfile.lowConfidence" })}</Banner>}
        <div className="grid min-h-0 min-w-0 flex-1 gap-8 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] xl:grid-rows-[minmax(0,1fr)]">
            <StyleProfileSources corpus={corpus} revisions={selectableRevisions} generalSettings={generalSettings} pendingAction={pendingAction} adding={adding} name={name} content={content} validationFailed={validationFailed} uploadFailed={uploadFailed} setAdding={setAdding} setName={setName} setContent={setContent} onImport={importFile} onSubmit={submit} onRemove={setRemovingId} onSetIncluded={(id, included) => run(`include:${id}`, () => setIncluded(id, included))} onSnapshot={setSnapshotRevisionId} />
            <StyleProfileInsights corpus={corpus} findings={findings} findingsStale={findingsStale} generalSettings={generalSettings} pendingAction={pendingAction} rules={rules} savedRules={savedRules} articleRules={articleRules} savedArticleRules={savedArticleRules} setRules={setRulesDraft} setArticleRules={setArticleRulesDraft} onSaveRules={() => run("rules", () => setRules(rules), () => setSavedRules(rules))} onSaveArticleRules={() => run("article-rules", () => setArticleRules(articleId, articleRules), () => setSavedArticleRules(articleRules))} ruleStatus={ruleStatus} />
        </div>
        <StyleProfileDialogs removingId={removingId} snapshotRevisionId={snapshotRevisionId} revisions={selectableRevisions} onCloseRemove={() => setRemovingId(undefined)} onConfirmRemove={confirmRemove} onCloseSnapshot={() => setSnapshotRevisionId(undefined)} onSelectSnapshot={setSnapshotRevisionId} onConfirmSnapshot={confirmSnapshot} />
    </div>;
}
