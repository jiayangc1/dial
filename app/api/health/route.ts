// Liveness probe for the container platform. No session, no Notion call.
export function GET() {
  return Response.json({ ok: true });
}
