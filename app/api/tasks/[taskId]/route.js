import { NextResponse } from "next/server";

import { getEvolinkTask } from "../../../../web/lib/evolink.mjs";
import { getGeminiVeoTask } from "../../../../web/lib/gemini-veo.mjs";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(_request, { params }) {
  try {
    const { taskId } = await params;
    if (taskId.startsWith("gemini-")) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return NextResponse.json({ error: "GEMINI_API_KEY non configurata sul server." }, { status: 500 });
      }
      const task = await getGeminiVeoTask(apiKey, taskId);
      return NextResponse.json(task);
    }

    const apiKey = process.env.EVOLINK_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "EVOLINK_API_KEY non configurata sul server." }, { status: 500 });
    }

    const task = await getEvolinkTask(apiKey, taskId);
    return NextResponse.json(task);
  } catch (error) {
    console.error("/api/tasks error", error);
    return NextResponse.json({ error: error.message || "Query task fallita." }, { status: 500 });
  }
}
