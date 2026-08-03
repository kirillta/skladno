import type { Server } from "node:http";


export function listenForLocalService(service: Server, port: number, host: string): Promise<void> {
    return new Promise((resolve, reject) => {
        function onListening(): void {
            service.off("error", onError);

            resolve();
        }


        function onError(error: Error): void {
            service.off("listening", onListening);

            reject(error);
        }


        service.once("listening", onListening);
        service.once("error", onError);
        service.listen(port, host);
    });
}


export function closeLocalService(service: Server): Promise<void> {
    return new Promise((resolve, reject) => {
        service.close((error) => {
            if (error) {
                reject(error);

                return;
            }

            resolve();
        });
    });
}
