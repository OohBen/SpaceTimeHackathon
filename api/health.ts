import { buildOrchestratorHealthPayload } from "../orchestrator/src/index.js";

export async function GET(): Promise<Response> {
  const payload = buildOrchestratorHealthPayload(process.env);
  return Response.json(payload, {
    status: payload.status === "ok" ? 200 : 500,
  });
}
