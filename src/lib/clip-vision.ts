import type { Part } from "@google/genai";

import { getGeminiClient } from "@/lib/gemini";

// Alias, not a pinned dated model — avoids breaking again when Google
// retires a specific version (as it did with gemini-2.5-flash).
const MODEL = "gemini-flash-latest";

const SYSTEM_PROMPT = `Du beschreibst kurz und knapp, was in Video-Vorschaubildern zu sehen ist (Motiv, Setting, Action, Stimmung) — für Sport-/Streetwear-Content von EdgeChase. Antworte ausschließlich mit kompaktem JSON im Format {"summaries": [{"clipId": string, "summary": string}]}. Jede Zusammenfassung maximal ein Satz.`;

interface ClipThumbnail {
  id: string;
  name: string;
  thumbnailLink: string;
}

async function fetchThumbnailAsBase64(
  thumbnailLink: string,
  accessToken: string
): Promise<{ data: string; mimeType: string } | null> {
  const res = await fetch(thumbnailLink, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) return null;

  const buffer = Buffer.from(await res.arrayBuffer());
  const mimeType = res.headers.get("content-type") ?? "image/jpeg";

  return { data: buffer.toString("base64"), mimeType };
}

export async function analyzeClipsVision(
  accessToken: string,
  clips: ClipThumbnail[]
): Promise<Record<string, string>> {
  const gemini = getGeminiClient();
  if (!gemini) {
    throw new Error("GEMINI_API_KEY ist nicht gesetzt.");
  }

  const parts: Part[] = [];

  for (const clip of clips) {
    const image = await fetchThumbnailAsBase64(clip.thumbnailLink, accessToken);
    if (!image) continue;

    parts.push({ text: `Clip-ID: ${clip.id} (Dateiname: ${clip.name})` });
    parts.push({ inlineData: { data: image.data, mimeType: image.mimeType } });
  }

  if (parts.length === 0) {
    return {};
  }

  parts.push({
    text: "Beschreibe jedes der obigen Vorschaubilder kurz. Gib für jede Clip-ID genau einen Eintrag zurück.",
  });

  const response = await gemini.models.generateContent({
    model: MODEL,
    contents: parts,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: "application/json",
    },
  });

  if (!response.text) {
    throw new Error("Keine Textantwort von Gemini erhalten.");
  }

  const parsed = JSON.parse(response.text) as {
    summaries: { clipId: string; summary: string }[];
  };

  return Object.fromEntries(parsed.summaries.map((s) => [s.clipId, s.summary]));
}
