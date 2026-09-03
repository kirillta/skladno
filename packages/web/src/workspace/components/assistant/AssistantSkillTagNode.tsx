import { useCallback } from "react";
import { useIntl } from "react-intl";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $applyNodeReplacement, $getNodeByKey, DecoratorNode, type LexicalNode, type NodeKey, type SerializedLexicalNode, type Spread } from "lexical";
import type { BuiltInSkillId } from "@skladno/shared";
import { skillMessages } from "./assistant-messages.js";


type SerializedAssistantSkillTagNode = Spread<{
    skill: BuiltInSkillId;
}, SerializedLexicalNode>;


function SkillTag({ skill, nodeKey }: { skill: BuiltInSkillId; nodeKey: NodeKey }) {
    const intl = useIntl();
    const [editor] = useLexicalComposerContext();
    const label = intl.formatMessage({ id: skillMessages[skill] });
    const remove = useCallback(() => {
        editor.update(() => $getNodeByKey(nodeKey)?.remove());
        editor.focus();
    }, [editor, nodeKey]);

    return <span data-assistant-skill-tag data-assistant-skill-chip contentEditable={false} className="mx-1 inline-flex h-5 min-h-0 max-w-[calc(100%-0.5rem)] items-center gap-1 align-middle rounded-full border border-brand/45 bg-brand-soft px-1.5 text-xs font-semibold text-brand" aria-label={intl.formatMessage({ id: "assistant.selectedSkill" }, { skill: label })}>
        <span className="relative -top-px">{label}</span>
        <button type="button" className="inline-grid size-3 min-h-0 place-items-center rounded-full p-0 text-brand/70 hover:bg-brand-soft hover:text-brand" aria-label={intl.formatMessage({ id: "assistant.removeSkill" }, { skill: label })} onMouseDown={(event) => event.preventDefault()} onClick={remove}>×</button>
    </span>;
}


export class AssistantSkillTagNode extends DecoratorNode<JSX.Element> {
    __skill: BuiltInSkillId;


    static getType(): string {
        return "assistant-skill-tag";
    }


    static clone(node: AssistantSkillTagNode): AssistantSkillTagNode {
        return new AssistantSkillTagNode(node.__skill, node.__key);
    }


    static importJSON(serializedNode: SerializedAssistantSkillTagNode): AssistantSkillTagNode {
        return $createAssistantSkillTagNode(serializedNode.skill);
    }


    constructor(skill: BuiltInSkillId, key?: NodeKey) {
        super(key);
        this.__skill = skill;
    }


    createDOM(): HTMLElement {
        return document.createElement("span");
    }


    updateDOM(): false {
        return false;
    }


    exportJSON(): SerializedAssistantSkillTagNode {
        return { ...super.exportJSON(), skill: this.__skill, type: "assistant-skill-tag", version: 1 };
    }


    getSkill(): BuiltInSkillId {
        return this.getLatest().__skill;
    }


    getTextContent(): string {
        return "";
    }


    isInline(): true {
        return true;
    }


    decorate(): JSX.Element {
        return <SkillTag skill={this.__skill} nodeKey={this.__key} />;
    }
}


export function $createAssistantSkillTagNode(skill: BuiltInSkillId): AssistantSkillTagNode {
    return $applyNodeReplacement(new AssistantSkillTagNode(skill));
}


export function $isAssistantSkillTagNode(node: LexicalNode | null | undefined): node is AssistantSkillTagNode {
    return node instanceof AssistantSkillTagNode;
}
