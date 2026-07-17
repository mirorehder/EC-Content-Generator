"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { Prisma } from "@/generated/prisma/client";
import { suggestCaption, suggestMatchingClips } from "@/lib/anthropic";
import { analyzeClipsVision } from "@/lib/clip-vision";
import { prisma } from "@/lib/prisma";
import { TREND_FORMATS } from "@/lib/trend-formats";

export interface ShotlistScene {
  order: number;
  clipId: string;
  clipName: string;
  note: string;
  timingSeconds: number;
}

export async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new Error("Nicht angemeldet.");
  return session;
}

export interface SuggestionResult {
  ok: boolean;
  caption?: string;
  hashtags?: string[];
  message?: string;
}

export async function generateCaptionSuggestionAction(
  trendFormatId: string,
  clipIds: string[]
): Promise<SuggestionResult> {
  await requireSession();

  const format = TREND_FORMATS.find((f) => f.id === trendFormatId);
  if (!format) {
    return { ok: false, message: "Unbekanntes Trend-Format." };
  }

  const clips = await prisma.clip.findMany({ where: { id: { in: clipIds } } });

  try {
    const suggestion = await suggestCaption(
      format.title,
      format.hook,
      clips.map((c) => c.name)
    );
    return { ok: true, caption: suggestion.caption, hashtags: suggestion.hashtags };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unbekannter Fehler.";
    return { ok: false, message: `KI-Vorschlag fehlgeschlagen: ${detail}` };
  }
}

export interface ClipSuggestionResult {
  ok: boolean;
  clipIds?: string[];
  message?: string;
}

export async function suggestClipsForConceptAction(
  trendFormatId: string
): Promise<ClipSuggestionResult> {
  const session = await requireSession();

  const format = TREND_FORMATS.find((f) => f.id === trendFormatId);
  if (!format) {
    return { ok: false, message: "Unbekanntes Trend-Format." };
  }

  if (!session.accessToken) {
    return { ok: false, message: "Kein Google-Zugriffstoken vorhanden. Bitte neu anmelden." };
  }

  const clips = await prisma.clip.findMany();
  if (clips.length === 0) {
    return { ok: false, message: "Keine synchronisierten Clips vorhanden." };
  }

  try {
    const clipsMissingVision = clips.filter((clip) => !clip.visionSummary && clip.thumbnailLink);

    if (clipsMissingVision.length > 0) {
      const summaries = await analyzeClipsVision(
        session.accessToken,
        clipsMissingVision.map((clip) => ({
          id: clip.id,
          name: clip.name,
          thumbnailLink: clip.thumbnailLink!,
        }))
      );

      await Promise.all(
        Object.entries(summaries).map(([clipId, summary]) =>
          prisma.clip.update({ where: { id: clipId }, data: { visionSummary: summary } })
        )
      );
    }

    const refreshedClips = await prisma.clip.findMany();

    const suggestedClipIds = await suggestMatchingClips(
      format.title,
      format.hook,
      format.structure,
      refreshedClips.map((clip) => ({ id: clip.id, name: clip.name, summary: clip.visionSummary }))
    );

    const validClipIds = suggestedClipIds.filter((id) =>
      refreshedClips.some((clip) => clip.id === id)
    );

    if (validClipIds.length === 0) {
      return { ok: false, message: "Keine passenden Clips gefunden." };
    }

    return { ok: true, clipIds: validClipIds };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unbekannter Fehler.";
    return { ok: false, message: `Clip-Vorschlag fehlgeschlagen: ${detail}` };
  }
}

export interface CreateConceptResult {
  ok: boolean;
  message: string;
}

export async function createConceptAction(
  _prevState: CreateConceptResult | null,
  formData: FormData
): Promise<CreateConceptResult> {
  await requireSession();

  const trendFormatId = formData.get("trendFormatId") as string | null;
  const clipIds = formData.getAll("clipIds") as string[];
  const caption = (formData.get("caption") as string | null)?.trim();
  const hashtagsRaw = (formData.get("hashtags") as string | null) ?? "";

  const format = TREND_FORMATS.find((f) => f.id === trendFormatId);

  if (!format) {
    return { ok: false, message: "Bitte ein Trend-Format auswählen." };
  }

  if (clipIds.length === 0) {
    return { ok: false, message: "Bitte mindestens einen Clip auswählen." };
  }

  if (!caption) {
    return { ok: false, message: "Bitte eine Caption angeben." };
  }

  const clips = await prisma.clip.findMany({ where: { id: { in: clipIds } } });
  const clipsById = new Map(clips.map((clip) => [clip.id, clip]));

  const stepCount = format.structure.length;
  const secondsPerStep = Math.max(1, Math.round(format.timingSeconds / stepCount));

  const shotlist: ShotlistScene[] = clipIds.map((clipId, index) => ({
    order: index + 1,
    clipId,
    clipName: clipsById.get(clipId)?.name ?? "Unbekannter Clip",
    note: format.structure[index % stepCount],
    timingSeconds: secondsPerStep,
  }));

  const hashtags = hashtagsRaw
    .split(/[,\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`));

  await prisma.concept.create({
    data: {
      trendFormatId: format.id,
      trendTitle: format.title,
      caption,
      hashtags,
      shotlist: shotlist as unknown as Prisma.InputJsonValue,
    },
  });

  revalidatePath("/dashboard/concepts");

  return { ok: true, message: "Konzept gespeichert." };
}
