export async function POST() {
  return Response.json(
    { error: "Webhook sync is disabled. User scoping now uses Clerk userId directly." },
    { status: 410 },
  );
}
