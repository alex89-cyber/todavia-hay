
import { createClient } from "@supabase/supabase-js";

import { isOwner, unauthorized } from "@/lib/owner-auth";
import { store, usingSupabase } from "@/lib/store";


const BUCKET = "dish-images";
const MAX_FILE_SIZE = 5 * 1024 * 1024;

type ImageKind = "logo" | "cover" | "gallery";

function isImageKind(value: unknown): value is ImageKind {
  return (
    value === "logo" ||
    value === "cover" ||
    value === "gallery"
  );
}

function detectImageType(
  bytes: Uint8Array,
): { mime: string; extension: string } | null {
  // JPEG
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return {
      mime: "image/jpeg",
      extension: "jpg",
    };
  }

  // PNG
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return {
      mime: "image/png",
      extension: "png",
    };
  }

  // WEBP
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return {
      mime: "image/webp",
      extension: "webp",
    };
  }

  return null;
}

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/stalls/[slug]/branding-image">,
) {
  // Solo el propietario puede subir imágenes.
  if (!(await isOwner((await ctx.params).slug))) {
    return unauthorized();
  }

  const { slug } = await ctx.params;

  const business = await store.get(slug);

  if (!business) {
    return Response.json(
      { error: "business_not_found" },
      { status: 404 },
    );
  }

  if (!usingSupabase) {
    return Response.json(
      { error: "storage_not_configured" },
      { status: 503 },
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return Response.json(
      { error: "storage_not_configured" },
      { status: 503 },
    );
  }

  // Rechazar solicitudes declaradas demasiado grandes.
  const declaredSize = Number(
    request.headers.get("content-length") ?? 0,
  );

  if (
    Number.isFinite(declaredSize) &&
    declaredSize > MAX_FILE_SIZE + 1_000_000
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

  const kind = form.get("kind");
  const file = form.get("file");

  if (!isImageKind(kind)) {
    return Response.json(
      { error: "invalid_image_kind" },
      { status: 400 },
    );
  }

  if (!(file instanceof File)) {
    return Response.json(
      { error: "missing_file" },
      { status: 400 },
    );
  }

  if (
    file.size === 0 ||
    file.size > MAX_FILE_SIZE
  ) {
    return Response.json(
      { error: "file_too_large" },
      { status: 413 },
    );
  }

  const acceptedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
  ];

  if (!acceptedTypes.includes(file.type)) {
    return Response.json(
      { error: "unsupported_image" },
      { status: 415 },
    );
  }

  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // Comprobar el contenido real del archivo,
  // no solamente su nombre o tipo declarado.
  const detected = detectImageType(bytes);

  if (!detected || detected.mime !== file.type) {
    return Response.json(
      { error: "invalid_image" },
      { status: 415 },
    );
  }

  const supabase = createClient(
    supabaseUrl,
    serviceKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  // Cada negocio tiene su propia carpeta.
  // Los archivos usan nombres únicos para evitar
  // reemplazar fotografías existentes.
  const path = [
    "business-branding",
    slug,
    kind,
    `${crypto.randomUUID()}.${detected.extension}`,
  ].join("/");

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: detected.mime,
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    console.error(
      "Business image upload failed:",
      uploadError,
    );

    return Response.json(
      { error: "upload_failed" },
      { status: 500 },
    );
  }

  const { data } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(path);

  return Response.json({
    ok: true,
    kind,
    url: data.publicUrl,
    path,
  });
}
