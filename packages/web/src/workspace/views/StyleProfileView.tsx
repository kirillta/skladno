import { useEffect, useRef, useState, type ChangeEvent } from "react";
import type { StyleCorpus, StyleReview } from "@skladno/shared";
import { Banner, Button, Field, IconButton, TextareaField } from "../../ui/primitives.js";
import { useIntl } from "react-intl";
import { DeleteIcon } from "../../ui/icons.js";
import type { MessageId } from "../../i18n/messages.js";


const traitTitles: Record<string, MessageId> = { voice: "styleProfile.trait.voice", rhythm: "styleProfile.trait.rhythm", structure: "styleProfile.trait.structure", vocabulary: "styleProfile.trait.vocabulary" };
const traitDescriptions: Record<string, MessageId> = {
    "personal author presence": "styleProfile.trait.personalAuthorPresence",
    "impersonal explanatory voice": "styleProfile.trait.impersonalExplanatoryVoice",
    "compact sentences": "styleProfile.trait.compactSentences",
    "long, developed sentences": "styleProfile.trait.longDevelopedSentences",
    "moderate sentence length": "styleProfile.trait.moderateSentenceLength",
    "frequent paragraph breaks": "styleProfile.trait.frequentParagraphBreaks",
    "developed paragraphs": "styleProfile.trait.developedParagraphs",
    "conversational contractions": "styleProfile.trait.conversationalContractions",
    "formal, expanded phrasing": "styleProfile.trait.formalExpandedPhrasing",
};
const quietScrollbar = "[scrollbar-color:var(--color-border-strong)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-button]:hidden [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border-strong";


export function StyleProfileView({ corpus, findings, findingsStale, articleId, add, remove, setIncluded, setRules, rebuild, getArticleRules, setArticleRules }: {
    corpus: StyleCorpus | undefined;
    findings: StyleReview | undefined;
    findingsStale: boolean;
    articleId: string;
    add: (name: string | undefined, content: string, origin?: "import") => Promise<void>;
    remove: (id: string) => Promise<void>;
    setIncluded: (id: string, included: boolean) => Promise<void>;
    setRules: (rules: string) => Promise<void>;
    rebuild: () => Promise<void>;
    getArticleRules: (articleId: string) => Promise<string>;
    setArticleRules: (articleId: string, rules: string) => Promise<string>;
}) {
    const intl = useIntl();
    const upload = useRef<HTMLInputElement>(null);
    const [name, setName] = useState("");
    const [content, setContent] = useState("");
    const [rules, setRulesDraft] = useState(corpus?.rules ?? "");
    const [rebuilt, setRebuilt] = useState(false);
    const [adding, setAdding] = useState(false);
    const [validationFailed, setValidationFailed] = useState(false);
    const [uploadFailed, setUploadFailed] = useState(false);
    const [articleRules, setArticleRulesDraft] = useState("");
    const [pendingAction, setPendingAction] = useState<string>();
    const activeCount = corpus?.items.filter((item) => item.included).length ?? 0;
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
        void getArticleRules(articleId).then(setArticleRulesDraft, () => undefined);
    }, [articleId, getArticleRules]);

    useEffect(() => {
        setRulesDraft(corpus?.rules ?? "");
    }, [corpus?.rules]);

    return <div className="flex h-full min-h-0 max-w-[120rem] flex-col">
        {rebuilt && <Banner className="mb-6" tone="success">{intl.formatMessage({ id: "styleProfile.rebuilt" }, { count: activeCount })}</Banner>}
        <header className="mb-8 shrink-0 flex flex-wrap items-start justify-between gap-4">
            <div>
                <h2 className="text-base font-semibold">{intl.formatMessage({ id: "views.styleProfile" })}</h2>
                <p className="mt-1 text-xs text-muted">{summary} · {intl.formatMessage({ id: "styleProfile.activeSources" }, { count: activeCount })}{corpus?.status === "outdated" ? ` · ${intl.formatMessage({ id: "styleProfile.outdated" })}` : ""}</p>
            </div>
            <Button variant="secondary" state={pendingAction === "rebuild" ? "loading" : "default"} disabled={corpus?.status === "empty" || Boolean(pendingAction)} onClick={() => run("rebuild", rebuild, () => setRebuilt(true))}>{intl.formatMessage({ id: "styleProfile.rebuild" })}</Button>
        </header>
        {corpus?.profile?.confidence === "low" && <Banner className="mb-6" tone="warning">{intl.formatMessage({ id: "styleProfile.lowConfidence" })}</Banner>}
        <div className="grid min-h-0 flex-1 gap-8 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] xl:grid-rows-[minmax(0,1fr)]">
            <section className={`min-h-0 overflow-y-auto pr-1 ${quietScrollbar}`}>
                <div className="mb-3 flex items-start justify-between"><div><h3 className="text-micro font-semibold uppercase tracking-overline text-muted">{intl.formatMessage({ id: "styleProfile.writingSamples" })}</h3><p className="mt-1 text-xs text-muted">{intl.formatMessage({ id: "styleProfile.corpusHint" })}</p></div><Button className="shrink-0 whitespace-nowrap" variant="quiet" aria-expanded={adding} aria-controls="style-profile-add-sample" onClick={() => setAdding((value) => !value)}>+ {intl.formatMessage({ id: "styleProfile.add" })}</Button></div>
                <div id="style-profile-add-sample" aria-hidden={!adding} {...(!adding ? { inert: true } : {}) as Record<string, boolean>} className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none ${adding ? "grid-rows-[1fr] opacity-100" : "pointer-events-none grid-rows-[0fr] opacity-0"}`}>
                    <div className="min-h-0 overflow-hidden">
                        <div className="mb-4 rounded-panel border border-border bg-surface p-4">
                            <label className="block text-xs font-semibold text-ink" htmlFor="style-profile-source-name">{intl.formatMessage({ id: "styleProfile.sourceName" })}</label>
                            <Field id="style-profile-source-name" placeholder={intl.formatMessage({ id: "styleProfile.sourceName" })} value={name} onChange={(event) => setName(event.target.value)} />
                            <label className="mt-3 block text-xs font-semibold text-ink" htmlFor="style-profile-source-content">{intl.formatMessage({ id: "styleProfile.paste" })}<span className="ml-1 text-danger" aria-hidden="true">*</span></label>
                            <TextareaField id="style-profile-source-content" required aria-required="true" aria-invalid={validationFailed && !content.trim()} className="mt-1 min-h-32" placeholder={intl.formatMessage({ id: "styleProfile.paste" })} value={content} onChange={(event) => setContent(event.target.value)} />
                            {validationFailed && <p className="mt-3 text-xs text-muted" role="alert">{intl.formatMessage({ id: "styleProfile.required" })}</p>}
                            {uploadFailed && <Banner className="mt-3" tone="warning" role="alert">{intl.formatMessage({ id: "styleProfile.invalidFile" })}</Banner>}
                            <p className="mt-1 text-xs text-muted">{intl.formatMessage({ id: "styleProfile.sourceNameHint" })}</p>
                            <div className="mt-3 flex gap-3">
                                <input ref={upload} className="sr-only" type="file" accept=".txt,.md,text/plain,text/markdown" onChange={importFile} />
                                <Button className="flex-1" variant="secondary" disabled={Boolean(pendingAction)} onClick={() => upload.current?.click()}>{intl.formatMessage({ id: "styleProfile.upload" })}</Button>
                                <Button className="relative" state={pendingAction === "add" ? "loading" : "default"} disabled={Boolean(pendingAction)} onClick={() => submit()}>{pendingAction === "add" ? <>
                                    <span className="invisible" aria-hidden="true">{intl.formatMessage({ id: "styleProfile.add" })}</span>
                                    <svg className="absolute inset-0 m-auto size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" /><path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" strokeWidth="3" /></svg><span className="sr-only" role="status">{intl.formatMessage({ id: "styleProfile.generatingSourceName" })}</span></> : intl.formatMessage({ id: "styleProfile.add" })}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="space-y-3">{corpus?.items.map((item) => <article className={`rounded-panel border p-4 ${item.included ? "border-border bg-surface-raised" : "border-border bg-surface"}`} key={item.id}>
                    <div className="grid grid-cols-[1rem_minmax(0,1fr)_2.25rem] items-center gap-2">
                        <input className="size-4 accent-brand" type="checkbox" checked={item.included} disabled={Boolean(pendingAction)} aria-label={intl.formatMessage({ id: "styleProfile.include" })} onChange={(event) => run(`include:${item.id}`, () => setIncluded(item.id, event.target.checked))} />
                        <p className="min-w-0 text-sm font-semibold">{item.name}</p>
                        <IconButton className="text-muted hover:bg-danger-soft hover:text-danger" label={intl.formatMessage({ id: "views.remove" })} disabled={Boolean(pendingAction)} onClick={() => run(`remove:${item.id}`, () => remove(item.id))}><DeleteIcon className="size-4" /></IconButton>
                    </div>
                    <p className="mt-2 text-sm italic text-muted">{item.excerpt}</p>
                    <p className="mt-2 text-xs text-muted">{intl.formatMessage({ id: "styleProfile.words" }, { count: item.wordCount })}</p>
                </article>)}
                </div>
            </section>
            <section className={`min-h-0 overflow-y-auto pr-1 ${quietScrollbar}`}>
                <h3 className="mb-4 text-micro font-semibold uppercase tracking-overline text-muted">{intl.formatMessage({ id: "styleProfile.detectedCharacteristics" })}</h3>
                <p className="-mt-2 mb-4 text-xs text-muted">{intl.formatMessage({ id: corpus?.profile ? "styleProfile.detectedHint" : "styleProfile.detectedEmpty" })}</p>
                <div className="space-y-4">{corpus?.profile?.traits.map((trait) => <div key={trait.id}><h4 className="font-semibold">{traitTitles[trait.id] ? intl.formatMessage({ id: traitTitles[trait.id] }) : trait.id}</h4><p className="mt-1 text-sm text-muted">{intl.formatMessage({ id: traitDescriptions[trait.label] ?? "styleProfile.trait.unknown" }, { label: trait.label, evidence: trait.evidence })}</p></div>)}</div>
                {corpus?.profile?.phrasesToAvoid.length ? <><h3 className="mb-3 mt-7 text-micro font-semibold uppercase tracking-overline text-muted">{intl.formatMessage({ id: "styleProfile.phrasesToAvoid" })}</h3><div className="flex flex-wrap gap-2">{corpus.profile.phrasesToAvoid.map((phrase) => <span className="rounded-control border border-danger/30 bg-danger-soft px-2 py-1 text-sm text-danger" key={phrase}>{phrase}</span>)}</div></> : null}
                <h3 className="mb-3 mt-7 text-micro font-semibold uppercase tracking-overline text-muted">{intl.formatMessage({ id: "styleProfile.manualRules" })}</h3>
                <TextareaField id="style-profile-global-rules" aria-label={intl.formatMessage({ id: "styleProfile.rules" })} className="min-h-36" placeholder={intl.formatMessage({ id: "styleProfile.rules" })} value={rules} onChange={(event) => setRulesDraft(event.target.value)} />
                <div className="mt-3 flex gap-3"><Button variant="quiet" disabled={Boolean(pendingAction)} onClick={() => document.getElementById("style-profile-global-rules")?.focus()}>{intl.formatMessage({ id: "styleProfile.addRule" })}</Button><Button variant="secondary" state={pendingAction === "rules" ? "loading" : "default"} disabled={Boolean(pendingAction)} onClick={() => run("rules", () => setRules(rules))}>{intl.formatMessage({ id: "styleProfile.saveRules" })}</Button></div>
                <h3 className="mb-3 mt-7 text-micro font-semibold uppercase tracking-overline text-muted">{intl.formatMessage({ id: "styleProfile.thisArticle" })}</h3>
                <TextareaField id="style-profile-article-rules" aria-label={intl.formatMessage({ id: "styleProfile.articleRules" })} className="min-h-28" placeholder={intl.formatMessage({ id: "styleProfile.articleRules" })} value={articleRules} onChange={(event) => setArticleRulesDraft(event.target.value)} />
                <Button className="mt-3" variant="secondary" state={pendingAction === "article-rules" ? "loading" : "default"} disabled={Boolean(pendingAction)} onClick={() => run("article-rules", () => setArticleRules(articleId, articleRules))}>{intl.formatMessage({ id: "styleProfile.saveRules" })}</Button>
                {findings && <h3 className="mb-3 mt-7 text-micro font-semibold uppercase tracking-overline text-muted">{intl.formatMessage({ id: "styleProfile.review" })}</h3>}
                {findingsStale && <Banner className="mb-3" tone="warning" role="alert">{intl.formatMessage({ id: "styleProfile.staleReview" })}</Banner>}
                {findings?.findings.map((finding) => <p key={finding.divergence} className="mt-3 text-sm">{finding.divergence}: {finding.suggestion}</p>)}
            </section>
        </div>
    </div>;
}
