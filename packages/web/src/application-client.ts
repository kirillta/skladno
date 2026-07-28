import {
  healthPath,
  parseHealthResponse,
  type ApplicationClient,
  type HealthResponse,
} from "@skladno/shared";

/** HTTP implementation of the UI's transport-neutral application boundary. */
export class HttpApplicationClient implements ApplicationClient {
  constructor(private readonly serviceUrl = "http://127.0.0.1:8787") {}

  async getHealth(): Promise<HealthResponse> {
    const response = await fetch(`${this.serviceUrl}${healthPath}`);
    if (!response.ok) {
      throw new Error(`The local service could not be reached (${response.status}).`);
    }
    return parseHealthResponse(await response.json());
  }
}
