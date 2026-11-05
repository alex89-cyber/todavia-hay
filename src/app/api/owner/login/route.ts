import { connection } from "next/server";
import { pinMatches, recordFailure, signIn, signOut, tooManyTries } from "@/lib/owner-auth";

// POST   /api/owner/login {pin}  signs this device in as the owner
// DELETE /api/owner/login        signs it out
export async function POST(request: Request) {
  await connection();
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (tooManyTries(ip)) return Response.json({ error: "too_many" }, { status: 429 });
  const body = (await request.json().catch(() => null)) as { pin?: unknown } | null;
  const pin = typeof body?.pin === "string" ? body.pin.slice(0, 32) : "";
  if (!pinMatches(pin)) {
    recordFailure(ip);
    return Response.json({ error: "wrong_pin" }, { status: 401 });
  }
  await signIn();
  return Response.json({ ok: true });
}

export async function DELETE() {
  await connection();
  await signOut();
  return Response.json({ ok: true });
}
