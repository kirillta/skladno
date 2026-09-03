import { useRef, type ChangeEvent } from "react";
import type { ArticleRevision, GeneralSettings, StyleCorpus } from "@skladno/shared";
import { Banner, Button, Field, IconButton, TextareaField } from "../../ui/primitives.js";
import { DeleteIcon } from "../../ui/icons.js";
import { formatDate } from "../../i18n/formatting.js";
import { useIntl } from "react-intl";


const quietScrollbar = "[scrollbar-color:var(--color-border-strong)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-button]:hidden [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border-strong";


export function StyleProfileSources({ corpus, revisions, generalSettings, pendingAction, adding, name, content, validationFailed, uploadFailed, setAdding, setName, setContent, onImport, onSubmit, onRemove, onSetIncluded, onSnapshot }: {
    corpus: StyleCorpus | undefined;
    revisions: readonly { revision: ArticleRevision; number: number }[];
    generalSettings: GeneralSettings;
    pendingAction: string | undefined;
    adding: boolean;
    name: string;
    content: string;
    validationFailed: boolean;
    uploadFailed: boolean;
    setAdding: (value: boolean | ((previous: boolean) => boolean)) => void;
    setName: (value: string) => void;
    setContent: (value: string) => void;
    onImport: (event: ChangeEvent<HTMLInputElement>) => void;
    onSubmit: () => void;
    onRemove: (id: string) => void;
    onSetIncluded: (id: string, included: boolean) => void;
    onSnapshot: (revisionId: string | undefined) => void;
}) {
    const intl = useIntl();
    const upload = useRef<HTMLInputElement>(null);

    return <section className={`min-h-0 min-w-0 overflow-y-auto px-1 ${quietScrollbar}`}>
        <div className="mb-3 flex flex-col items-start gap-3">
            <div className="min-w-0">
                <h3 className="text-micro font-semibold uppercase tracking-overline text-muted">{intl.formatMessage({ id: "styleProfile.writingSamples" })}</h3>
                <p className="mt-1 text-xs text-muted">{intl.formatMessage({ id: "styleProfile.corpusHint" })}</p>
            </div>
            <div className="flex flex-wrap gap-2">
                <Button variant="quiet" onClick={() => onSnapshot(revisions[0]?.revision.id)} disabled={!revisions.length || Boolean(pendingAction)}>{intl.formatMessage({ id: "styleProfile.addRevision" })}</Button>
                <Button variant="quiet" aria-expanded={adding} aria-controls="style-profile-add-sample" onClick={() => setAdding((value) => !value)}>{intl.formatMessage({ id: "styleProfile.addWritingSample" })}</Button>
            </div>
        </div>
        <div id="style-profile-add-sample" aria-hidden={!adding} {...(!adding ? { inert: true } : {}) as Record<string, boolean>} className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none ${adding ? "grid-rows-[1fr] opacity-100" : "pointer-events-none grid-rows-[0fr] opacity-0"}`}>
            <div className="min-h-0 overflow-hidden">
                <div className="mb-4 rounded-panel border border-border bg-surface p-4">
                    <label className="block text-xs font-semibold text-ink" htmlFor="style-profile-source-name">{intl.formatMessage({ id: "styleProfile.sourceName" })}</label>
                    <Field id="style-profile-source-name" placeholder={intl.formatMessage({ id: "styleProfile.sourceName" })} value={name} onChange={(event) => setName(event.target.value)} />
                    <label className="mt-3 block text-xs font-semibold text-ink" htmlFor="style-profile-source-content">{intl.formatMessage({ id: "styleProfile.paste" })}
                        <span className="ml-1 text-danger" aria-hidden="true">*</span>
                    </label>
                    <TextareaField id="style-profile-source-content" required aria-required="true" aria-invalid={validationFailed && !content.trim()} className="mt-1 min-h-32" placeholder={intl.formatMessage({ id: "styleProfile.paste" })} value={content} onChange={(event) => setContent(event.target.value)} />
                    {validationFailed && <p className="mt-3 text-xs text-muted" role="alert">{intl.formatMessage({ id: "styleProfile.required" })}</p>}
                    {uploadFailed && <Banner className="mt-3" tone="warning" role="alert">{intl.formatMessage({ id: "styleProfile.invalidFile" })}</Banner>}
                    <p className="mt-1 text-xs text-muted">{intl.formatMessage({ id: "styleProfile.sourceNameHint" })}</p>
                    <div className="mt-3 flex gap-3">
                        <input ref={upload} className="sr-only" type="file" accept=".txt,.md,text/plain,text/markdown" onChange={onImport} />
                        <Button className="flex-1" variant="secondary" disabled={Boolean(pendingAction)} onClick={() => upload.current?.click()}>{intl.formatMessage({ id: "styleProfile.upload" })}</Button>
                        <Button state={pendingAction === "add" ? "loading" : "default"} loadingLabel={intl.formatMessage({ id: "styleProfile.generatingSourceName" })} disabled={Boolean(pendingAction)} onClick={() => onSubmit()}>{intl.formatMessage({ id: "styleProfile.add" })}</Button>
                    </div>
                </div>
            </div>
        </div>
        <div className="space-y-3">{corpus?.items.map((item) => <article className={`rounded-panel border p-4 ${item.included ? "border-border bg-surface-raised" : "border-border bg-surface"}`} key={item.id}>
            <div className="grid grid-cols-[1rem_minmax(0,1fr)_2.25rem] items-center gap-2">
                <input className="size-4 accent-brand" type="checkbox" checked={item.included} disabled={Boolean(pendingAction)} aria-label={intl.formatMessage({ id: "styleProfile.include" })} onChange={(event) => onSetIncluded(item.id, event.target.checked)} />
                <p className="min-w-0 text-sm font-semibold">{item.name}</p>
                <IconButton className="text-muted hover:bg-danger-soft hover:text-danger" label={intl.formatMessage({ id: "views.remove" })} disabled={Boolean(pendingAction)} onClick={() => onRemove(item.id)}><DeleteIcon className="size-4" /></IconButton>
            </div>
            <p className="mt-2 text-sm italic text-muted">{item.excerpt}</p>
            <p className="mt-2 text-xs text-muted">{intl.formatMessage({ id: "styleProfile.words" }, { count: item.wordCount })} · {intl.formatMessage({ id: "styleProfile.addedDate" }, { date: formatDate(item.createdAt, generalSettings.dateFormat, generalSettings.timeZone) })}</p>
        </article>)}</div>
    </section>;
}
