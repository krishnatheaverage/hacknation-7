// Quick deploy check: open /api/health on the live URL. Answers come from the rules
// engine, so no model or API key is used at question time.
export async function GET() {
  return Response.json({ ok: true, engine: "rules engine, no model at query time" });
}
