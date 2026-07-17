import { GoogleGenAI } from "@google/genai";

// Alias, not a pinned dated model — avoids breaking again when Google
// retires a specific version (as it did with gemini-2.5-flash).
const MODEL = "gemini-flash-latest";

let client: GoogleGenAI | undefined;

export function getGeminiClient(): GoogleGenAI | null {
  if (!process.env.GEMINI_API_KEY) return null;
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

const EDGECHASE_SYSTEM_PROMPT = `Du schreibst Hook-Texte und Captions für EdgeChase, eine Sport-/Streetwear-Marke.
Ton: direkt, energiegeladen, kurz. Keine Ausrufezeichen-Häufung, keine generischen Marketing-Phrasen.
Antworte ausschließlich mit kompaktem JSON im Format {"caption": string, "hashtags": string[]}.`;

export interface CaptionSuggestion {
  caption: string;
  hashtags: string[];
}

export async function suggestCaption(
  trendTitle: string,
  hook: string,
  clipNames: string[]
): Promise<CaptionSuggestion> {
  const gemini = getGeminiClient();

  if (!gemini) {
    throw new Error("GEMINI_API_KEY ist nicht gesetzt.");
  }

  const response = await gemini.models.generateContent({
    model: MODEL,
    contents: `Trend-Format: ${trendTitle}\nHook-Vorlage: ${hook}\nClips in dieser Shotlist: ${clipNames.join(", ") || "(keine)"}\n\nSchreibe eine passende Caption mit 3-5 Hashtags.`,
    config: {
      systemInstruction: EDGECHASE_SYSTEM_PROMPT,
      responseMimeType: "application/json",
    },
  });

  if (!response.text) {
    throw new Error("Keine Textantwort von Gemini erhalten.");
  }

  return JSON.parse(response.text) as CaptionSuggestion;
}

const CLIP_MATCH_SYSTEM_PROMPT = `Du wählst für EdgeChase-Kurzvideos passende Rohclips zu einem vorgegebenen Hook-Format aus.
Antworte ausschließlich mit kompaktem JSON im Format {"clipIds": string[]} — die IDs in der empfohlenen Reihenfolge (bester Clip zuerst).`;

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
  const gemini = getGeminiClient();

  if (!gemini) {
    throw new Error("GEMINI_API_KEY ist nicht gesetzt.");
  }

  const clipList = clips
    .map((clip) => {
      const category = clip.category ? ` [Ordner: ${clip.category}]` : "";
      const summary = clip.summary ? ` — ${clip.summary}` : "";
      return `- ${clip.id}: ${clip.name}${category}${summary}`;
    })
    .join("\n");

  const response = await gemini.models.generateContent({
    model: MODEL,
    contents: `Trend-Format: ${trendTitle}\nHook-Vorlage: ${hook}\nSzenen-Struktur:\n${structure.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\nVerfügbare Clips:\n${clipList || "(keine)"}\n\nWähle die ${structure.length} am besten passenden Clips aus (weniger, falls nicht genug verfügbar sind).`,
    config: {
      systemInstruction: CLIP_MATCH_SYSTEM_PROMPT,
      responseMimeType: "application/json",
    },
  });

  if (!response.text) {
    throw new Error("Keine Textantwort von Gemini erhalten.");
  }

  const parsed = JSON.parse(response.text) as { clipIds: string[] };
  return parsed.clipIds;
}
