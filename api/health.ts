import {
  buildHealthPayload,
  readOrchestratorServerConfig,
} from "../orchestrator/src/index.js";

export async function GET(): Promise<Response> {
  const payload = await buildHealthPayload(readOrchestratorServerConfig(process.env));
  return Response.json(payload, {
    status: payload.status === "ok" ? 200 : 500,
  });
}
