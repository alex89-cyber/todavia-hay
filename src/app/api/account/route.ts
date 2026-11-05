import { z } from "zod";
import { currentAccount } from "@/lib/auth/server";
import { saveProfile } from "@/lib/accounts";

// PUT /api/account { firstName, lastName, phone }
const Body = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  phone: z.string().max(20).nullable(),
});

export async function PUT(request: Request) {
  const me = await currentAccount();
  if (!me) return Response.json({ error: "signed_out" }, { status: 401 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "bad_name" }, { status: 400 });
  const r = await saveProfile(me.id, parsed.data);
  return Response.json({ result: r }, { status: r === "ok" ? 200 : 409 });
}
