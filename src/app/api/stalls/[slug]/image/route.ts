import "server-only";

import { createClient } from "@supabase/supabase-js";

import {
  isOwner,
  unauthorized,
} from "@/lib/owner-auth";

import { store } from "@/lib/store";

const BUCKET = "dish-images";
const MAX_BYTES = 5 * 1024 * 1024;

const ALLOWED_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

function validImage(
  bytes: Uint8Array,
  type: string,
): boolean {
  if (type === "image/jpeg") {
    return (
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff
    );
  }

  if (type === "image/png") {
    const signature = [
      137, 80, 78, 71, 13, 10, 26, 10,
    ];

    return signature.every(
      (byte, index) => bytes[index] === byte,
    );
  }

  if (type === "image/webp") {
    const ascii = (
      start: number,
      word: string,
    ) =>
      [...word].every(
        (letter, index) =>
          bytes[start + index] ===
          letter.charCodeAt(0),
      );

    return (
      bytes.length >= 12 &&
      ascii(0, "RIFF") &&
      ascii(8, "WEBP")
    );
  }

  return false;
}

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/stalls/[slug]/image">,
) {
  // La subida requiere la misma sesión de dueño
  // que el resto del panel.
  if (!(await isOwner())) {
    return unauthorized();
  }

  const { slug } = await ctx.params;

  const business = await store.get(slug);

  if (!business) {
    return Response.json(
      { error: "not_found" },
      { status: 404 },
    );
  }

  const declaredLength = Number(
    request.headers.get("content-length") ?? 0,
  );

  if (
    declaredLength > 0 &&
    declaredLength > MAX_BYTES + 100_000
  ) {
    return Response.json(
      { error: "file_too_large" },
      { status: 413 },
    );
  }

  let form: FormData;

  try {
    form = await request.formData();
  } catch {
    return Response.json(
      { error: "invalid_form" },
      { status: 400 },
    );
  }

  const file = form.get("file");

  if (!(file instanceof File)) {
    return Response.json(
      { error: "missing_file" },
      { status: 400 },
    );
  }

  const extension = ALLOWED_TYPES.get(file.type);

  if (!extension) {
    return Response.json(
      { error: "invalid_file_type" },
      { status: 400 },
    );
  }

  if (file.size === 0 || file.size > MAX_BYTES) {
    return Response.json(
      { error: "file_too_large" },
      { status: 413 },
    );
  }

  const bytes = new Uint8Array(
    await file.arrayBuffer(),
  );

  if (!validImage(bytes, file.type)) {
    return Response.json(
      { error: "invalid_image" },
      { status: 400 },
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error(
      "Missing Supabase server configuration",
    );

    return Response.json(
      { error: "storage_unavailable" },
      { status: 500 },
    );
  }

  const supabase = createClient(
    url,
    serviceKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  const path = [
    encodeURIComponent(slug),
    `${crypto.randomUUID()}.${extension}`,
  ].join("/");

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    console.error("Image upload failed:", error);

    return Response.json(
      { error: "upload_failed" },
      { status: 500 },
    );
  }

  const { data } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(path);

  return Response.json(
    {
      imageUrl: data.publicUrl,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
