import { isSupportedArticleLink, PASTE_SEMANTICS, WORD_PASTE } from "./paste-constants.js";


function hasWordListMetadata(node: HTMLElement): boolean {
    return WORD_PASTE.listMetadataPattern.test(node.getAttribute("style") ?? "")
        || WORD_PASTE.listMetadataPattern.test(node.className);
}


function wordListType(node: HTMLElement): "bullet" | "number" | undefined {
    const tag = node.tagName.toLowerCase();
    if (!WORD_PASTE.listCandidateElementNames.has(tag))
        return undefined;

    const plainText = node.textContent?.trimStart() ?? "";
    if (WORD_PASTE.bulletMarkerPattern.test(plainText))
        return "bullet";

    if (!hasWordListMetadata(node))
        return undefined;

    return WORD_PASTE.numberMarkerPattern.test(plainText) ? "number" : "bullet";
}


function removeLeadingListMarker(node: HTMLElement, listType: "bullet" | "number") {
    for (const element of [...node.querySelectorAll<HTMLElement>("*")]) {
        if (WORD_PASTE.listMarkerIgnorePattern.test(element.getAttribute("style") ?? ""))
            element.remove();
    }

    const walker = node.ownerDocument.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    let textNode = walker.nextNode();
    while (textNode) {
        const content = textNode.textContent ?? "";
        if (content.trim()) {
            textNode.textContent = content.replace(
                listType === "number"
                    ? WORD_PASTE.numberMarkerPattern
                    : WORD_PASTE.bulletMarkerPattern,
                "",
            );
            return;
        }

        textNode = walker.nextNode();
    }
}


function convertWordLists(document: Document) {
    const candidates = [...document.body.querySelectorAll<HTMLElement>(WORD_PASTE.listCandidateSelector)];
    const converted = new Set<HTMLElement>();

    for (const candidate of candidates) {
        if (converted.has(candidate))
            continue;

        const type = wordListType(candidate);
        if (!type)
            continue;

        const list = document.createElement(
            type === "number"
                ? PASTE_SEMANTICS.orderedListTagName
                : PASTE_SEMANTICS.unorderedListTagName,
        );
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
    const href = tag === PASTE_SEMANTICS.anchorTagName ? element.getAttribute("href")?.trim() : undefined;
    const weight = element.style.fontWeight;
    const bold = weight === PASTE_SEMANTICS.boldKeyword
        || Number(weight) >= PASTE_SEMANTICS.boldMinimumWeight;
    const italic = element.style.fontStyle === PASTE_SEMANTICS.italicStyle;
    const strikethrough = element.style.textDecorationLine.includes(PASTE_SEMANTICS.lineThroughStyle)
        || element.style.textDecoration.includes(PASTE_SEMANTICS.lineThroughStyle);

    for (const attribute of [...element.attributes])
        element.removeAttribute(attribute.name);

    if (tag === PASTE_SEMANTICS.anchorTagName && href && isSupportedArticleLink(href))
        element.setAttribute("href", href);

    if (bold)
        element.style.fontWeight = PASTE_SEMANTICS.lexicalBoldWeight;

    if (italic)
        element.style.fontStyle = PASTE_SEMANTICS.italicStyle;

    if (strikethrough)
        element.style.textDecoration = PASTE_SEMANTICS.lineThroughStyle;
}


function removeRedundantTrailingNodes(element: HTMLElement) {
    if (!WORD_PASTE.blockElementNames.has(element.tagName.toLowerCase()))
        return;

    let trailing = element.lastChild;
    while (trailing) {
        const previous = trailing.previousSibling;
        if (trailing.nodeType === Node.TEXT_NODE && !trailing.textContent?.trim())
            trailing.remove();
        else if (trailing instanceof HTMLElement && !trailing.textContent?.trim() && trailing.tagName.toLowerCase() !== PASTE_SEMANTICS.lineBreakTagName)
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
    document.body.querySelectorAll(PASTE_SEMANTICS.unsafeElementSelector).forEach((node) => node.remove());
    convertWordLists(document);

    for (const element of [...document.body.querySelectorAll<HTMLElement>("*")]) {
        if (element.tagName.toLowerCase() === PASTE_SEMANTICS.anchorTagName && !isSupportedArticleLink(element.getAttribute("href") ?? "")) {
            element.replaceWith(...element.childNodes);
            continue;
        }

        retainSupportedElementSemantics(element);
        removeRedundantTrailingNodes(element);
    }

    return document;
}
