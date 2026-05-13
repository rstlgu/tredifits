import { NextResponse } from "next/server";

import { buildSupabaseObjectPath, getSupabaseStorageConfig, uploadToSupabaseStorage } from "../../../web/lib/supabase-storage.mjs";

export const runtime = "nodejs";

export async function POST(request) {
  let config;
  try {
    config = getSupabaseStorageConfig();
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const formData = await request.formData();
  const files = formData.getAll("files").filter((item) => item instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "Aggiungi almeno un file." }, { status: 400 });
  }

  const uploads = [];
  for (const file of files) {
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: `${file.name} supera 50MB.` }, { status: 400 });
    }

    const path = buildSupabaseObjectPath({ fileName: file.name });
    const result = await uploadToSupabaseStorage({ file, path, config });

    uploads.push({
      name: file.name,
      type: file.type,
      storagePath: result.path,
      url: result.publicUrl
    });
  }

  return NextResponse.json({ uploads });
}
