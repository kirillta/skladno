import { loadServerConfig } from "./config.js";
import { createLocalService } from "./http.js";
import { openDatabase, Repositories } from "./persistence/index.js";

const config = loadServerConfig();
const database = openDatabase(config.databasePath);
const service = createLocalService(config, new Repositories(database));


service.listen(config.port, config.host, () => {
    console.info(`Skladno local service listening at http://${config.host}:${config.port}`);
});


process.once("SIGINT", () => database.close());
process.once("SIGTERM", () => database.close());
