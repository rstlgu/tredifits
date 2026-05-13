import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { buildPublicUploadUrl, safeUploadName } from "../../../web/lib/evolink.mjs";

export const runtime = "nodejs";

export async function POST(request) {
  const formData = await request.formData();
  const files = formData.getAll("files").filter((item) => item instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ error: "Aggiungi almeno un file." }, { status: 400 });
  }

  const uploads = [];
  const uploadDir = join(process.cwd(), "public", "uploads");
  await mkdir(uploadDir, { recursive: true });

  for (const file of files) {
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: `${file.name} supera 50MB.` }, { status: 400 });
    }

    const uniqueName = `${Date.now()}-${crypto.randomUUID()}-${safeUploadName(file.name)}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    await writeFile(join(uploadDir, uniqueName), bytes);

    uploads.push({
      name: file.name,
      type: file.type,
      url: buildPublicUploadUrl(new URL(request.url).origin, uniqueName)
    });
  }

  return NextResponse.json({ uploads });
}
