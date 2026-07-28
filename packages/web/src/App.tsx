import { useEffect, useState } from "react";
import { HttpApplicationClient } from "./application-client";

type HealthState = "loading" | "ready" | "error";

const client = new HttpApplicationClient();

export function App() {
  const [state, setState] = useState<HealthState>("loading");
  const [message, setMessage] = useState("Checking the local service…");

  useEffect(() => {
    client
      .getHealth()
      .then(() => {
        setState("ready");
        setMessage("Local service is ready.");
      })
      .catch(() => {
        setState("error");
        setMessage("Local service is unavailable. Start it, then refresh this page.");
      });
  }, []);

  return (
    <main>
      <h1>Skladno</h1>
      <p>Your ideas, in your voice.</p>
      <p aria-live="polite" data-state={state}>
        {message}
      </p>
    </main>
  );
}
