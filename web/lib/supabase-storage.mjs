import { randomUUID } from "node:crypto";

import { safeUploadName } from "./evolink.mjs";

export function getSupabaseStorageConfig(env = process.env) {
  const url = env.SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = env.SUPABASE_STORAGE_BUCKET || "tredifits-temp";
  if (!url || !serviceRoleKey) {
    throw new Error("Configura SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY per usare upload temporaneo.");
  }
  return {
    url: url.replace(/\/$/, ""),
    serviceRoleKey,
    bucket
  };
}

export function buildSupabaseObjectPath({ fileName, id = randomUUID() }) {
  return `temp/${id}/${safeUploadName(fileName)}`;
}

export function isSafeSupabaseObjectPath(path) {
  return /^temp\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(path) && !path.includes("..");
}

export function buildSupabasePublicUrl({ url, bucket, path }) {
  return `${url}/storage/v1/object/public/${encodeURIComponent(bucket)}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

export async function uploadToSupabaseStorage({ file, path, config }) {
  const bytes = Buffer.from(await file.arrayBuffer());
  const response = await fetch(`${config.url}/storage/v1/object/${encodeURIComponent(config.bucket)}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.serviceRoleKey}`,
      apikey: config.serviceRoleKey,
      "Content-Type": file.type || "application/octet-stream",
      "x-upsert": "true"
    },
    body: bytes
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.message || `Supabase upload failed with ${response.status}`);
  }

  return {
    path,
    publicUrl: buildSupabasePublicUrl({ url: config.url, bucket: config.bucket, path })
  };
}

export async function removeSupabaseObjects({ paths, config }) {
  const safePaths = paths.filter((path) => typeof path === "string" && isSafeSupabaseObjectPath(path));
  if (safePaths.length === 0) return [];

  const response = await fetch(`${config.url}/storage/v1/object/${encodeURIComponent(config.bucket)}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${config.serviceRoleKey}`,
      apikey: config.serviceRoleKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ prefixes: safePaths })
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.message || `Supabase cleanup failed with ${response.status}`);
  }
  return safePaths;
}
