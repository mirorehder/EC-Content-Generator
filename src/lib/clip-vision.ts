import type Anthropic from "@anthropic-ai/sdk";

import { getAnthropicClient } from "@/lib/anthropic";

const SYSTEM_PROMPT = `Du beschreibst kurz und knapp, was in Video-Vorschaubildern zu sehen ist (Motiv, Setting, Action, Stimmung) — für Sport-/Streetwear-Content von EdgeChase. Antworte ausschließlich mit kompaktem JSON im Format {"summaries": [{"clipId": string, "summary": string}]}, ohne weiteren Text. Jede Zusammenfassung maximal ein Satz.`;

interface ClipThumbnail {
  id: string;
  name: string;
  thumbnailLink: string;
}

async function fetchThumbnailAsBase64(
  thumbnailLink: string,
  accessToken: string
): Promise<{ data: string; mediaType: string } | null> {
  const res = await fetch(thumbnailLink, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) return null;

  const buffer = Buffer.from(await res.arrayBuffer());
  const mediaType = res.headers.get("content-type") ?? "image/jpeg";

  return { data: buffer.toString("base64"), mediaType };
}

export async function analyzeClipsVision(
  accessToken: string,
  clips: ClipThumbnail[]
): Promise<Record<string, string>> {
  const anthropic = getAnthropicClient();
  if (!anthropic) {
    throw new Error("ANTHROPIC_API_KEY ist nicht gesetzt.");
  }

  const content: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam)[] = [];

  for (const clip of clips) {
    const image = await fetchThumbnailAsBase64(clip.thumbnailLink, accessToken);
    if (!image) continue;

    content.push({ type: "text", text: `Clip-ID: ${clip.id} (Dateiname: ${clip.name})` });
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: image.mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
        data: image.data,
      },
    });
  }

  if (content.length === 0) {
    return {};
  }

  content.push({
    type: "text",
    text: "Beschreibe jedes der obigen Vorschaubilder kurz. Gib für jede Clip-ID genau einen Eintrag zurück.",
  });

  const messages: Anthropic.MessageParam[] = [{ role: "user", content }];

  const response = await anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages,
  });

  if (response.stop_reason === "refusal") {
    throw new Error("Anthropic hat die Bildanalyse abgelehnt.");
  }

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Keine Textantwort von Anthropic erhalten.");
  }

  const parsed = JSON.parse(textBlock.text) as {
    summaries: { clipId: string; summary: string }[];
  };

  return Object.fromEntries(parsed.summaries.map((s) => [s.clipId, s.summary]));
}
