const wordBulletMarker = /^[\s\u00a0]*(?:[\u00b7\u2022\u2023\u25aa\u25e6])[\s\u00a0]*/;
const wordNumberMarker = /^[\s\u00a0]*\d+[.)][\s\u00a0]*/;


function hasWordListMetadata(node: HTMLElement): boolean {
    return /mso-list/i.test(node.getAttribute("style") ?? "")
        || /MsoList/i.test(node.className);
}


function wordListType(node: HTMLElement): "bullet" | "number" | undefined {
    const tag = node.tagName.toLowerCase();
    if (tag !== "p" && tag !== "div")
        return undefined;

    const plainText = node.textContent?.trimStart() ?? "";
    if (wordBulletMarker.test(plainText))
        return "bullet";

    if (!hasWordListMetadata(node))
        return undefined;

    return wordNumberMarker.test(plainText) ? "number" : "bullet";
}


function removeLeadingListMarker(node: HTMLElement, listType: "bullet" | "number") {
    for (const element of [...node.querySelectorAll<HTMLElement>("*")]) {
        if (/mso-list\s*:\s*ignore/i.test(element.getAttribute("style") ?? ""))
            element.remove();
    }

    const walker = node.ownerDocument.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    let textNode = walker.nextNode();
    while (textNode) {
        const content = textNode.textContent ?? "";
        if (content.trim()) {
            textNode.textContent = content.replace(listType === "number" ? wordNumberMarker : wordBulletMarker, "");
            return;
        }

        textNode = walker.nextNode();
    }
}


function convertWordLists(document: Document) {
    const candidates = [...document.body.querySelectorAll<HTMLElement>("p, div")];
    const converted = new Set<HTMLElement>();

    for (const candidate of candidates) {
        if (converted.has(candidate))
            continue;

        const type = wordListType(candidate);
        if (!type)
            continue;

        const list = document.createElement(type === "number" ? "ol" : "ul");
        candidate.before(list);

        let current: HTMLElement | null = candidate;
        while (current && wordListType(current) === type) {
            converted.add(current);
            const next: HTMLElement | null = current.nextElementSibling instanceof HTMLElement
                ? current.nextElementSibling
                : null;
            const item = document.createElement("li");
            item.append(...current.childNodes);
            removeLeadingListMarker(item, type);
            list.append(item);
            current.remove();
            current = next;
        }
    }
}


function retainSupportedElementSemantics(element: HTMLElement) {
    const tag = element.tagName.toLowerCase();
    const href = tag === "a" ? element.getAttribute("href")?.trim() : undefined;
    const weight = element.style.fontWeight;
    const bold = weight === "bold" || Number(weight) >= 600;
    const italic = element.style.fontStyle === "italic";
    const strikethrough = element.style.textDecorationLine.includes("line-through")
        || element.style.textDecoration.includes("line-through");

    for (const attribute of [...element.attributes])
        element.removeAttribute(attribute.name);

    if (tag === "a" && href && /^(https?:|mailto:)/i.test(href))
        element.setAttribute("href", href);

    if (bold)
        element.style.fontWeight = "700";

    if (italic)
        element.style.fontStyle = "italic";

    if (strikethrough)
        element.style.textDecoration = "line-through";
}


function removeRedundantTrailingNodes(element: HTMLElement) {
    const blockTags = new Set(["p", "div", "li", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6"]);
    if (!blockTags.has(element.tagName.toLowerCase()))
        return;

    let trailing = element.lastChild;
    while (trailing) {
        const previous = trailing.previousSibling;
        if (trailing.nodeType === Node.TEXT_NODE && !trailing.textContent?.trim())
            trailing.remove();
        else if (trailing instanceof HTMLElement && !trailing.textContent?.trim() && trailing.tagName.toLowerCase() !== "br")
            trailing.remove();
        else if (trailing instanceof HTMLBRElement)
            trailing.remove();
        else
            break;

        trailing = previous;
    }
}


/** Produces a detached, safe semantic DOM for direct Lexical import. */
export function sanitizeRichPasteDocument(html: string): Document {
    const document = new DOMParser().parseFromString(html, "text/html");
    const unsafeTags = "script, style, link, svg, img, video, audio, object, embed, iframe, canvas";
    document.body.querySelectorAll(unsafeTags).forEach((node) => node.remove());
    convertWordLists(document);

    for (const element of [...document.body.querySelectorAll<HTMLElement>("*")]) {
        if (element.tagName.toLowerCase() === "a" && !/^(https?:|mailto:)/i.test(element.getAttribute("href")?.trim() ?? "")) {
            element.replaceWith(...element.childNodes);
            continue;
        }

        retainSupportedElementSemantics(element);
        removeRedundantTrailingNodes(element);
    }

    return document;
}
