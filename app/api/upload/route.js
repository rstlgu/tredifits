import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { buildPublicUploadUrl, isPublicHttpOrigin, safeUploadName } from "../../../web/lib/evolink.mjs";

export const runtime = "nodejs";

export async function POST(request) {
  const requestOrigin = new URL(request.url).origin;
  const publicOrigin = process.env.PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : requestOrigin);
  if (!isPublicHttpOrigin(publicOrigin)) {
    return NextResponse.json(
      {
        error:
          "Upload temporaneo non disponibile in locale: EvoLink deve poter scaricare i file da un URL pubblico. Imposta PUBLIC_APP_URL con un dominio/tunnel HTTPS pubblico oppure usa URL pubblici."
      },
      { status: 400 }
    );
  }

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
      fileName: uniqueName,
      url: buildPublicUploadUrl(publicOrigin, uniqueName)
    });
  }

  return NextResponse.json({ uploads });
}
