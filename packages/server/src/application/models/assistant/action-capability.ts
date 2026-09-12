import type { EditorialCapabilityId } from "../../services/assistant/editorial-capability-catalog.js";

export type ActionCapability = Extract<EditorialCapabilityId, "rename_article" | "change_article_language" | "assign_publishing_profile" | "set_article_style_rules" | "add_revision_to_style_corpus" | "rebuild_style_profile">;
