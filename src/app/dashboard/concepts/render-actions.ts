"use server";

import { prisma } from "@/lib/prisma";
import { requireSession, type ShotlistScene } from "./actions";

export interface RenderJobScene {
  driveFileId: string;
  clipName: string;
  timingSeconds: number;
}

export interface RenderJob {
  ok: boolean;
  message?: string;
  /** Google-Zugriffstoken der eigenen Session — der Browser lädt die Clips damit direkt von Drive. */
  accessToken?: string;
  scenes?: RenderJobScene[];
  caption?: string;
  fileBaseName?: string;
}

/**
 * Liefert dem Browser alles, was er zum clientseitigen Rendern braucht.
 * Das eigentliche Schneiden passiert komplett im Browser
 * (src/lib/browser-render.ts) — hier wird nur autorisiert und aufgelöst,
 * welche Drive-Dateien zu den Szenen gehören.
 */
export async function getRenderJobAction(conceptId: string): Promise<RenderJob> {
  const session = await requireSession();

  if (!session.accessToken) {
    return { ok: false, message: "Kein Google-Zugriffstoken vorhanden. Bitte neu anmelden." };
  }

  const concept = await prisma.concept.findUnique({ where: { id: conceptId } });
  if (!concept) {
    return { ok: false, message: "Konzept nicht gefunden." };
  }

  const scenes = concept.shotlist as unknown as ShotlistScene[];
  const clips = await prisma.clip.findMany({
    where: { id: { in: scenes.map((scene) => scene.clipId) } },
  });
  const clipsById = new Map(clips.map((clip) => [clip.id, clip]));

  const jobScenes: RenderJobScene[] = [];
  for (const scene of scenes) {
    const clip = clipsById.get(scene.clipId);
    if (!clip) {
      return { ok: false, message: `Clip "${scene.clipName}" nicht gefunden — Drive neu synchronisieren?` };
    }
    jobScenes.push({
      driveFileId: clip.driveFileId,
      clipName: clip.name,
      timingSeconds: scene.timingSeconds,
    });
  }

  return {
    ok: true,
    accessToken: session.accessToken,
    scenes: jobScenes,
    caption: `${concept.caption} ${concept.hashtags.join(" ")}`.trim(),
    fileBaseName: concept.trendTitle
      .toLowerCase()
      .replace(/[^a-z0-9äöüß]+/gi, "-")
      .replace(/^-+|-+$/g, ""),
  };
}
