
import { NextResponse } from "next/server";
import { admin } from "@/lib/accounts";
import { supabaseServer } from "@/lib/auth/server";
import {
  LEGAL_VERSION,
  type LegalRole,
} from "@/lib/legal";

export async function POST() {
  try {
    const sb = await supabaseServer();

    const { data, error: authError } =
      await sb.auth.getUser();

    if (authError || !data.user) {
      return NextResponse.json(
        { error: "Inicia sesión para continuar." },
        { status: 401 },
      );
    }

    const userId = data.user.id;
    const db = admin();

    const { data: memberships, error: memberError } =
      await db
        .from("business_members")
        .select("role")
        .eq("user_id", userId);

    if (memberError) throw memberError;

    const roles = (memberships ?? []).map(
      (membership) => membership.role,
    );

    let legalRole: LegalRole = "customer";

    if (roles.includes("owner")) {
      legalRole = "owner";
    } else if (
      roles.some((role) =>
        ["manager", "waiter", "kitchen", "staff"]
          .includes(role),
      )
    ) {
      legalRole = "employee";
    }

    const { error } = await db
      .from("legal_acceptances")
      .upsert(
        {
          user_id: userId,
          document_type: legalRole,
          document_version: LEGAL_VERSION,
        },
        {
          onConflict:
            "user_id,document_type,document_version",
          ignoreDuplicates: true,
        },
      );

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      role: legalRole,
      version: LEGAL_VERSION,
    });
  } catch (error) {
    console.error("legal acceptance:", error);

    return NextResponse.json(
      {
        error:
          "No se pudo registrar la aceptación.",
      },
      { status: 500 },
    );
  }
}
