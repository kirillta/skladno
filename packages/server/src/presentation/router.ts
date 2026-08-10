import type { IncomingMessage, ServerResponse } from "node:http";


function routeParameters(path: RegExp | string, pathname: string): string[] | undefined {
    if (typeof path === "string")
        return path === pathname ? [] : undefined;

    const match = path.exec(pathname);
    return match ? match.slice(1).map(decodeURIComponent) : undefined;
}


export class Router {
    private readonly routes: {
        method: string;
        path: RegExp | string;
        handler: (request: IncomingMessage, response: ServerResponse, parameters: string[]) => Promise<void> | void;
    }[] = [];


    register(method: string, path: RegExp | string, handler: (request: IncomingMessage, response: ServerResponse, parameters: string[]) => Promise<void> | void): void {
        this.routes.push({ method, path, handler });
    }


    async handle(request: IncomingMessage, response: ServerResponse, pathname: string): Promise<boolean> {
        for (const route of this.routes) {
            if (route.method !== request.method)
                continue;

            const parameters = routeParameters(route.path, pathname);
            if (!parameters)
                continue;

            await route.handler(request, response, parameters);
            return true;
        }

        return false;
    }
}
