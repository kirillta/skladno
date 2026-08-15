import { useState } from "react";
import { Button, TextareaField } from "../../ui/primitives.js";
import { useIntl } from "react-intl";


export function PublishingPreviewView({ publishing }: {
    publishing: {
        text: string;
        length: { count: number; remaining: number; state: "within-limit" | "near-limit" | "over-limit" };
        copy: () => Promise<void>;
    }
}) {
    const intl = useIntl();
    const [copying, setCopying] = useState(false);
    const copy = () => {
        setCopying(true);
        void publishing.copy().then(() => setCopying(false), () => setCopying(false));
    };
    return <div>
        <h2 className="text-base font-semibold">{intl.formatMessage({ id: "views.publishingPreview" })}</h2>
        <p className={publishing.length.state === "over-limit" ? "mt-1 text-xs text-danger" : publishing.length.state === "near-limit" ? "mt-1 text-xs text-warning" : "mt-1 text-xs text-muted"}>{publishing.length.state === "over-limit"
            ? intl.formatMessage({ id: "publishing.charactersOverGuidance" }, { count: intl.formatNumber(Math.abs(publishing.length.remaining)) })
            : intl.formatMessage({ id: "publishing.charactersRemaining" }, { count: intl.formatNumber(publishing.length.remaining) })}</p>
        <TextareaField aria-label={intl.formatMessage({ id: "views.plainTextPreview" })} className="mt-3 min-h-72" readOnly value={publishing.text} />
        <Button className="mt-3" variant="secondary" state={copying ? "loading" : "default"} onClick={copy}>{intl.formatMessage({ id: "views.copyPlainText" })}</Button>
    </div>;
}
