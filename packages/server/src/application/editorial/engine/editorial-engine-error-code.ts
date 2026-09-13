import { EDITORIAL_ENGINE_ERROR } from "./editorial-engine-errors.js";


export type EditorialEngineErrorCode = typeof EDITORIAL_ENGINE_ERROR[keyof typeof EDITORIAL_ENGINE_ERROR];
