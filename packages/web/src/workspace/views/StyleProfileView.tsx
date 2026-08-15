import { useEffect, useRef, useState, type ChangeEvent } from "react";
import type { StyleCorpus, StyleReview } from "@skladno/shared";
import { Banner, Button, Field, IconButton, TextareaField } from "../../ui/primitives.js";
import { useIntl } from "react-intl";
import { DeleteIcon } from "../../ui/icons.js";


export function StyleProfileView({ corpus, findings, articleId, add, remove, setIncluded, setRules, rebuild, getArticleRules, setArticleRules }: {
    corpus: StyleCorpus | undefined;
    findings: StyleReview | undefined;
    articleId: string;
    add: (name: string, content: string, origin?: "import") => Promise<void>;
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
    const [articleRules, setArticleRulesDraft] = useState("");
    const activeCount = corpus?.items.filter((item) => item.included).length ?? 0;
    const summary = corpus?.profile
        ? intl.formatMessage({ id: "styleProfile.summary" }, { version: corpus.profile.version, confidence: corpus.profile.confidence })
        : intl.formatMessage({ id: "styleProfile.none" });
    const submit = (origin?: "import") => {
        if (!name.trim() || !content.trim())
            return;

        void add(name, content, origin).then(() => {
            setName("");
            setContent("");
            setAdding(false);
        });
    };
    const importFile = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !/\.(txt|md)$/i.test(file.name))
            return;

        void file.text().then((text) => {
            setName(file.name.replace(/\.(txt|md)$/i, ""));
            setContent(text);
        });
        event.target.value = "";
    };

    useEffect(() => {
        void getArticleRules(articleId).then(setArticleRulesDraft);
    }, [articleId, getArticleRules]);

    return <div className="max-w-[120rem]">
        {rebuilt && <Banner className="mb-6" tone="success">{intl.formatMessage({ id: "styleProfile.rebuilt" }, { count: activeCount })}</Banner>}
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
            <div>
                <h2 className="text-base font-semibold">{intl.formatMessage({ id: "views.styleProfile" })}</h2>
                <p className="mt-1 text-xs text-muted">{summary} · {intl.formatMessage({ id: "styleProfile.activeSources" }, { count: activeCount })}{corpus?.status === "outdated" ? ` · ${intl.formatMessage({ id: "styleProfile.outdated" })}` : ""}</p>
            </div>
            <Button variant="secondary" disabled={corpus?.status === "empty"} onClick={() => void rebuild().then(() => setRebuilt(true))}>{intl.formatMessage({ id: "styleProfile.rebuild" })}</Button>
        </header>
        {corpus?.profile?.confidence === "low" && <Banner className="mb-6" tone="warning">{intl.formatMessage({ id: "styleProfile.lowConfidence" })}</Banner>}
        <div className="grid gap-8 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <section>
                <div className="mb-3 flex items-start justify-between"><h3 className="text-micro font-semibold uppercase tracking-overline text-muted">{intl.formatMessage({ id: "styleProfile.writingSamples" })}</h3><Button variant="quiet" aria-expanded={adding} aria-controls="style-profile-add-sample" onClick={() => setAdding((value) => !value)}>+ {intl.formatMessage({ id: "styleProfile.add" })}</Button></div>
                {adding && <div id="style-profile-add-sample" className="mb-4 rounded-panel border border-border bg-surface p-4">
                    <Field placeholder={intl.formatMessage({ id: "styleProfile.sourceName" })} value={name} onChange={(event) => setName(event.target.value)} />
                    <TextareaField className="mt-3 min-h-32" placeholder={intl.formatMessage({ id: "styleProfile.paste" })} value={content} onChange={(event) => setContent(event.target.value)} />
                    <div className="mt-3 flex gap-3"><input ref={upload} className="sr-only" type="file" accept=".txt,.md,text/plain,text/markdown" onChange={importFile} /><Button className="flex-1" variant="secondary" onClick={() => upload.current?.click()}>{intl.formatMessage({ id: "styleProfile.upload" })}</Button><Button onClick={() => submit()}>{intl.formatMessage({ id: "styleProfile.add" })}</Button></div>
                </div>}
                <div className="space-y-3">{corpus?.items.map((item) => <article className={`rounded-panel border p-4 ${item.included ? "border-border bg-surface-raised" : "border-border bg-surface opacity-60"}`} key={item.id}>
                    <div className="grid grid-cols-[1rem_minmax(0,1fr)_2.25rem] items-center gap-2">
                        <input className="size-4 accent-brand" type="checkbox" checked={item.included} aria-label={intl.formatMessage({ id: "styleProfile.include" })} onChange={(event) => void setIncluded(item.id, event.target.checked)} />
                        <p className="min-w-0 text-sm font-semibold">{item.name}</p>
                        <IconButton className="text-muted hover:bg-danger-soft hover:text-danger" label={intl.formatMessage({ id: "views.remove" })} onClick={() => void remove(item.id)}><DeleteIcon className="size-4" /></IconButton>
                    </div>
                    <p className="mt-2 text-sm italic text-muted">{item.excerpt}</p>
                    <p className="mt-2 text-xs text-muted">{intl.formatMessage({ id: "styleProfile.words" }, { count: item.wordCount })}</p>
                </article>)}
                </div>
            </section>
            <section>
                <h3 className="mb-4 text-micro font-semibold uppercase tracking-overline text-muted">{intl.formatMessage({ id: "styleProfile.detectedCharacteristics" })}</h3>
                <div className="space-y-4">{corpus?.profile?.traits.map((trait) => <div key={trait.id}><h4 className="font-semibold">{trait.id}</h4><p className="mt-1 text-sm text-muted">{trait.label}. {trait.evidence}</p></div>)}</div>
                {corpus?.profile?.phrasesToAvoid.length ? <><h3 className="mb-3 mt-7 text-micro font-semibold uppercase tracking-overline text-muted">{intl.formatMessage({ id: "styleProfile.phrasesToAvoid" })}</h3><div className="flex flex-wrap gap-2">{corpus.profile.phrasesToAvoid.map((phrase) => <span className="rounded-control border border-danger/30 bg-danger-soft px-2 py-1 text-sm text-danger" key={phrase}>{phrase}</span>)}</div></> : null}
                <h3 className="mb-3 mt-7 text-micro font-semibold uppercase tracking-overline text-muted">{intl.formatMessage({ id: "styleProfile.manualRules" })}</h3>
                <TextareaField className="min-h-36" placeholder={intl.formatMessage({ id: "styleProfile.rules" })} value={rules} onChange={(event) => setRulesDraft(event.target.value)} />
                <div className="mt-3 flex gap-3"><Button variant="quiet" onClick={() => setRulesDraft((value) => `${value}${value ? "\n" : ""}`)}>{intl.formatMessage({ id: "styleProfile.addRule" })}</Button><Button variant="secondary" onClick={() => void setRules(rules)}>{intl.formatMessage({ id: "styleProfile.saveRules" })}</Button></div>
                <h3 className="mb-3 mt-7 text-micro font-semibold uppercase tracking-overline text-muted">{intl.formatMessage({ id: "styleProfile.thisArticle" })}</h3>
                <TextareaField className="min-h-28" placeholder={intl.formatMessage({ id: "styleProfile.articleRules" })} value={articleRules} onChange={(event) => setArticleRulesDraft(event.target.value)} />
                <Button className="mt-3" variant="secondary" onClick={() => void setArticleRules(articleId, articleRules)}>{intl.formatMessage({ id: "styleProfile.saveRules" })}</Button>
                {findings?.findings.map((finding) => <p key={finding.divergence} className="mt-3 text-sm">{finding.divergence}: {finding.suggestion}</p>)}
            </section>
        </div>
    </div>;
}
