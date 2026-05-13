export function hasRemoveBgKey(env = process.env) {
  return Boolean(env.REMOVE_BG_API_KEY);
}

export async function removeBackgroundWithRemoveBg({ bytes, fileName = "frame.png", apiKey = process.env.REMOVE_BG_API_KEY }) {
  if (!apiKey) {
    throw new Error("REMOVE_BG_API_KEY non configurata.");
  }

  const form = new FormData();
  form.append("image_file", new Blob([bytes], { type: "image/png" }), fileName);
  form.append("size", "auto");
  form.append("format", "png");

  const response = await fetch("https://api.remove.bg/v1.0/removebg", {
    method: "POST",
    headers: {
      "X-Api-Key": apiKey
    },
    body: form
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`remove.bg failed with ${response.status}: ${errorText.slice(0, 200)}`);
  }

  return Buffer.from(await response.arrayBuffer());
}
