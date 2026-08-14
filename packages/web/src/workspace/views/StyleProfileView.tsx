import { useState } from "react";
import type { StyleCorpus, StyleReview } from "@skladno/shared";
import { Button, Field, TextareaField } from "../../ui/primitives.js";
import { useIntl } from "react-intl";


export function StyleProfileView({ corpus, findings, add, remove }: {
    corpus: StyleCorpus | undefined;
    findings: StyleReview | undefined;
    add: (name: string, content: string) => Promise<void>;
    remove: (id: string) => Promise<void>
}) {
    const intl = useIntl();
    const [name, setName] = useState("");
    const [content, setContent] = useState("");

    return <div>
        <h2 className="font-semibold">{intl.formatMessage({ id: "views.styleProfile" })}</h2>
        <p className="text-sm text-muted">{intl.formatMessage({ id: "views.styleIntro" })}</p>
        <div className="mt-3 space-y-2">{corpus?.items.map((item) => <div className="flex gap-2" key={item.id}>{item.name}
            <Button variant="danger" onClick={() => void remove(item.id)}>{intl.formatMessage({ id: "views.remove" })}</Button>
        </div>)}
        </div>
        <Field className="mt-3" placeholder={intl.formatMessage({ id: "views.sampleName" })} value={name} onChange={(event) => setName(event.target.value)} />
        <TextareaField className="mt-2" placeholder={intl.formatMessage({ id: "views.writingSample" })} value={content} onChange={(event) => setContent(event.target.value)} />
        <Button className="mt-2" onClick={() => {
            if (name.trim() && content.trim())
                void add(name, content).then(() => {
                    setName("");
                    setContent("");
                });
        }}>{intl.formatMessage({ id: "views.addToCorpus" })}</Button>
        {findings?.findings.map((finding) => <p key={finding.divergence} className="mt-3">{finding.divergence}: {finding.suggestion}</p>)}
    </div>;
}
