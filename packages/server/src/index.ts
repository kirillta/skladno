import { loadServerConfig } from "./config.js";
import { createLocalService } from "./http.js";

const config = loadServerConfig();
const service = createLocalService(config);

service.listen(config.port, config.host, () => {
  console.info(`Skladno local service listening at http://${config.host}:${config.port}`);
});
