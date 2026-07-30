import { useState } from "react";
import type { CreateArticleInput } from "@skladno/shared";
import { Button, Dialog, Field, TextareaField } from "../../ui/primitives.js";

export function CreateArticleDialog({ open, close, create }: {
    open: boolean;
    close: () => void;
    create: (input: CreateArticleInput) => Promise<unknown>
}) {
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");

    if (!open)
        return null;

    return <Dialog open>
        <form className="grid gap-3" onSubmit={(event) => {
            event.preventDefault();
            void create({ title: title.trim() || "Untitled article", content }).then(close);
        }}>
            <h2 className="font-semibold">Create Article</h2>
            <Field aria-label="Article title" value={title} onChange={(event) => setTitle(event.target.value)} autoFocus placeholder="Article title" />
            <TextareaField aria-label="Article starting text" value={content} onChange={(event) => setContent(event.target.value)} placeholder="Theses or starting draft" />
            <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={close}>Cancel</Button>
                <Button type="submit">Create Article</Button>
            </div>
        </form>
    </Dialog>;
}
