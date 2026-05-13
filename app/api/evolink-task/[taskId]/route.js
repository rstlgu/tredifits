import { NextResponse } from "next/server";

import { getEvolinkTask } from "../../../../web/lib/evolink.mjs";

export const runtime = "nodejs";

export async function GET(_request, { params }) {
  const apiKey = process.env.EVOLINK_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "EVOLINK_API_KEY non configurata sul server." }, { status: 500 });
  }

  const { taskId } = await params;
  const task = await getEvolinkTask(apiKey, taskId);
  return NextResponse.json(task);
}
