type DiagnosticEvent = "service.started" | "service.start_failed" | "service.shutdown_failed" | "request.failed" | "backup.failed";

type DiagnosticWriter = (line: string) => void;


interface LocalDiagnosticsOptions {
    stdout?: DiagnosticWriter;
    stderr?: DiagnosticWriter;
    environment?: NodeJS.ProcessEnv;
}


const privateField = /^(api.?key|authorization|content|body|message|prompt|article|model|request|response|secret|token|password)$/i;


function redact(value: unknown, environmentValues: Set<string>, seen = new WeakSet<object>()): unknown {
    if (typeof value === "string") {
        let redacted = value;
        for (const secret of environmentValues)
            redacted = redacted.replaceAll(secret, "[REDACTED]");

        return redacted;
    }

    if (Array.isArray(value))
        return value.map((item) => redact(item, environmentValues, seen));

    if (!value || typeof value !== "object")
        return value;

    if (seen.has(value))
        return "[REDACTED]";

    seen.add(value);
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, privateField.test(key) ? "[REDACTED]" : redact(item, environmentValues, seen)]));
}


function errorContext(error: unknown): Record<string, string | number> {
    if (!error || typeof error !== "object")
        return {};

    const context: Record<string, string | number> = {};
    if (error instanceof Error)
        context.errorName = error.name;

    if ("code" in error && (typeof error.code === "string" || typeof error.code === "number"))
        context.errorCode = error.code;

    return context;
}


function write(writer: DiagnosticWriter, event: DiagnosticEvent, context: Record<string, unknown>, environmentValues: Set<string>): void {
    try {
        writer(`${JSON.stringify(redact({ timestamp: new Date().toISOString(), event, ...context }, environmentValues))}\n`);
    } catch {
        // Diagnostics are advisory and must not interrupt the local service.
    }
}


export function createLocalDiagnostics({
    stdout = (line) => {
        process.stdout.write(line);
    },
    stderr = (line) => {
        process.stderr.write(line);
    },
    environment = process.env,
}: LocalDiagnosticsOptions = {}) {
    return {
        write(event: DiagnosticEvent, context: Record<string, unknown> = {}, error?: unknown): void {
            const environmentValues = new Set(Object.values(environment).filter((value): value is string => Boolean(value)));
            write(event.endsWith("failed") ? stderr : stdout, event, { ...context, ...errorContext(error) }, environmentValues);
        },
    };
}


export type LocalDiagnostics = ReturnType<typeof createLocalDiagnostics>;
