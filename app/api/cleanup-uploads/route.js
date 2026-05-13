import { NextResponse } from "next/server";
import { unlink } from "node:fs/promises";
import { join } from "node:path";

import { isSafeUploadedFileName } from "../../../web/lib/evolink.mjs";

export const runtime = "nodejs";

export async function POST(request) {
  const { fileNames = [] } = await request.json().catch(() => ({}));
  if (!Array.isArray(fileNames)) {
    return NextResponse.json({ error: "fileNames non valido." }, { status: 400 });
  }

  const uploadDir = join(process.cwd(), "public", "uploads");
  const deleted = [];
  for (const fileName of fileNames) {
    if (typeof fileName !== "string" || !isSafeUploadedFileName(fileName)) continue;
    try {
      await unlink(join(uploadDir, fileName));
      deleted.push(fileName);
    } catch {
      // File already gone: cleanup remains idempotent.
    }
  }

  return NextResponse.json({ deleted });
}
