import { getHealthPayload } from "../lib/chat-service.js";

export async function GET() {
  return Response.json(getHealthPayload());
}
