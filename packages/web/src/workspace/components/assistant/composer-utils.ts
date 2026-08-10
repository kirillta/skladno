function isComposerDecoration(node: Node): boolean {
    return node instanceof HTMLElement && node.dataset.assistantComposerDecoration !== undefined;
}


export function textBeforeSkill(composer: HTMLDivElement): number {
    let length = 0;
    for (const node of composer.childNodes) {
        if (node instanceof HTMLElement && node.dataset.assistantSkillChip !== undefined)
            return length;

        if (!isComposerDecoration(node))
            length += node.textContent?.length ?? 0;
    }

    return length;
}


export function composerText(composer: HTMLDivElement): string {
    return [...composer.childNodes]
        .filter((node) => !isComposerDecoration(node))
        .map((node) => node.textContent ?? "")
        .join("");
}


export function composerCaretOffset(composer: HTMLDivElement): number {
    const selection = window.getSelection();
    if (!selection?.rangeCount)
        return composerText(composer).length;

    const range = selection.getRangeAt(0);
    const beforeCaret = range.cloneRange();
    beforeCaret.selectNodeContents(composer);
    beforeCaret.setEnd(range.endContainer, range.endOffset);

    const walker = document.createTreeWalker(composer, NodeFilter.SHOW_TEXT);
    let offset = 0;
    let node = walker.nextNode();

    while (node) {
        if (!node.parentElement?.closest("[data-assistant-composer-decoration]")) {
            if (beforeCaret.comparePoint(node, node.textContent?.length ?? 0) !== 1)
                offset += node.textContent?.length ?? 0;
            else if (node === range.endContainer)
                offset += range.endOffset;
        }

        node = walker.nextNode();
    }

    return offset;
}


export function placeCaretAfterSkill(composer: HTMLDivElement): void {
    const skill = composer.querySelector<HTMLElement>("[data-assistant-skill-chip]");
    if (!skill)
        return;

    const range = document.createRange();
    range.setStartAfter(skill);
    range.collapse(true);

    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
}
