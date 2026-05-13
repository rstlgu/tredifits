import { NextResponse } from "next/server";

import { getSupabaseStorageConfig, removeSupabaseObjects } from "../../../web/lib/supabase-storage.mjs";

export const runtime = "nodejs";

export async function POST(request) {
  let config;
  try {
    config = getSupabaseStorageConfig();
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { storagePaths = [] } = await request.json().catch(() => ({}));
  if (!Array.isArray(storagePaths)) {
    return NextResponse.json({ error: "storagePaths non valido." }, { status: 400 });
  }

  const deleted = await removeSupabaseObjects({ paths: storagePaths, config }).catch(() => []);
  return NextResponse.json({ deleted });
}
