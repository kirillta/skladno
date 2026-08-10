import type { BuiltInSkillId, EditorialOperation } from "@skladno/shared";

import type { EditorialEngine } from "./editorial-engine.js";


export interface EditorialEngineResolver {
    resolve(operation: EditorialOperation, assistantSkillId?: BuiltInSkillId): EditorialEngine | undefined;
}
