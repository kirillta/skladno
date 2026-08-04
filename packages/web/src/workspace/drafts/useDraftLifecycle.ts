import { useCallback, useReducer, useRef } from "react";
import {
    reduceDraftLifecycleSessions,
    type DraftLifecycleSessionEvent,
    type DraftLifecycleSessions,
} from "./draft-lifecycle.js";


export function useDraftLifecycle(initialSessions: DraftLifecycleSessions = {}) {
    const sessionsRef = useRef<DraftLifecycleSessions>(initialSessions);
    const [sessions, dispatch] = useReducer(reduceDraftLifecycleSessions, initialSessions);

    const send = useCallback((action: DraftLifecycleSessionEvent): DraftLifecycleSessions => {
        const next = reduceDraftLifecycleSessions(sessionsRef.current, action);
        sessionsRef.current = next;
        dispatch(action);

        return next;
    }, []);

    const replace = useCallback((next: DraftLifecycleSessions) => {
        sessionsRef.current = next;
        dispatch({ type: "replace", sessions: next });
    }, []);

    return {
        sessions,
        sessionsRef,
        send,
        replace,
    };
}
