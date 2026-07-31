/** Converts clipboard HTML to the deliberately small Article Markdown subset. */
export function sanitizeRichPaste(html: string): string {
    const body = new DOMParser().parseFromString(html, "text/html").body;

    const text = (node: Node): string => {
        if (node.nodeType === Node.TEXT_NODE)
            return node.textContent ?? "";

        if (!(node instanceof HTMLElement))
            return "";

        const tag = node.tagName.toLowerCase();
        if (["script", "style", "svg", "img", "video", "audio", "object", "embed", "iframe"].includes(tag))
            return "";

        const content = [...node.childNodes].map(text).join("");
        if (/^h[1-6]$/.test(tag))
            return `${"#".repeat(Number(tag[1]))} ${content.trim()}\n\n`;

        if (tag === "p" || tag === "div")
            return `${content.trim()}\n\n`;

        if (tag === "br")
            return "\\\n";

        if (tag === "strong" || tag === "b")
            return `**${content}**`;

        if (tag === "em" || tag === "i")
            return `*${content}*`;

        if (tag === "s" || tag === "strike" || tag === "del")
            return `~~${content}~~`;

        if (tag === "code" && node.parentElement?.tagName.toLowerCase() !== "pre")
            return `\`${content}\``;

        if (tag === "pre")
            return `\`\`\`\n${content}\n\`\`\`\n\n`;

        if (tag === "a") {
            const href = node.getAttribute("href")?.trim() ?? "";
            return /^(https?:|mailto:)/i.test(href)
                ? `[${content}](${href})`
                : content;
        }

        if (tag === "blockquote")
            return `${content.trim().split("\n").map((line) => `> ${line}`).join("\n")}\n\n`;

        if (tag === "li")
            return `- ${content.trim()}\n`;

        if (tag === "ul" || tag === "ol")
            return `${content}\n`;

        return content;
    };

    return [...body.childNodes].map(text).join("").replace(/\n{3,}/g, "\n\n").trim();
}
