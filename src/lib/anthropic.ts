import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | undefined;

export function getAnthropicClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  client ??= new Anthropic();
  return client;
}

const EDGECHASE_SYSTEM_PROMPT = `Du schreibst Hook-Texte und Captions für EdgeChase, eine Sport-/Streetwear-Marke.
Ton: direkt, energiegeladen, kurz. Keine Ausrufezeichen-Häufung, keine generischen Marketing-Phrasen.
Antworte ausschließlich mit kompaktem JSON im Format {"caption": string, "hashtags": string[]} ohne weiteren Text.`;

export interface CaptionSuggestion {
  caption: string;
  hashtags: string[];
}

export async function suggestCaption(
  trendTitle: string,
  hook: string,
  clipNames: string[]
): Promise<CaptionSuggestion> {
  const anthropic = getAnthropicClient();

  if (!anthropic) {
    throw new Error("ANTHROPIC_API_KEY ist nicht gesetzt.");
  }

  const response = await anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 1024,
    system: EDGECHASE_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Trend-Format: ${trendTitle}\nHook-Vorlage: ${hook}\nClips in dieser Shotlist: ${clipNames.join(", ") || "(keine)"}\n\nSchreibe eine passende Caption mit 3-5 Hashtags.`,
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("Anthropic hat die Anfrage abgelehnt.");
  }

  const textBlock = response.content.find((block) => block.type === "text");

  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Keine Textantwort von Anthropic erhalten.");
  }

  const parsed = JSON.parse(textBlock.text) as CaptionSuggestion;
  return parsed;
}

const CLIP_MATCH_SYSTEM_PROMPT = `Du wählst für EdgeChase-Kurzvideos passende Rohclips zu einem vorgegebenen Hook-Format aus.
Antworte ausschließlich mit kompaktem JSON im Format {"clipIds": string[]} — die IDs in der empfohlenen Reihenfolge (bester Clip zuerst), ohne weiteren Text.`;

export interface ClipForMatching {
  id: string;
  name: string;
  summary: string | null;
  category: string | null;
}

export async function suggestMatchingClips(
  trendTitle: string,
  hook: string,
  structure: string[],
  clips: ClipForMatching[]
): Promise<string[]> {
  const anthropic = getAnthropicClient();

  if (!anthropic) {
    throw new Error("ANTHROPIC_API_KEY ist nicht gesetzt.");
  }

  const clipList = clips
    .map((clip) => {
      const category = clip.category ? ` [Ordner: ${clip.category}]` : "";
      const summary = clip.summary ? ` — ${clip.summary}` : "";
      return `- ${clip.id}: ${clip.name}${category}${summary}`;
    })
    .join("\n");

  const response = await anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 1024,
    system: CLIP_MATCH_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Trend-Format: ${trendTitle}\nHook-Vorlage: ${hook}\nSzenen-Struktur:\n${structure.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\nVerfügbare Clips:\n${clipList || "(keine)"}\n\nWähle die ${structure.length} am besten passenden Clips aus (weniger, falls nicht genug verfügbar sind).`,
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("Anthropic hat die Anfrage abgelehnt.");
  }

  const textBlock = response.content.find((block) => block.type === "text");

  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Keine Textantwort von Anthropic erhalten.");
  }

  const parsed = JSON.parse(textBlock.text) as { clipIds: string[] };
  return parsed.clipIds;
}
