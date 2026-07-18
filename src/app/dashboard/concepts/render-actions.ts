"use server";

import { mkdir } from "node:fs/promises";
import path from "node:path";

import { prisma } from "@/lib/prisma";
import { createRenderToken } from "@/lib/render-tokens";
import { renderShotlistVideo } from "@/lib/remotion-render";
import type { ShotlistVideoProps } from "../../../../remotion/ShotlistVideo";
import { requireSession, type ShotlistScene } from "./actions";

export interface StartRenderResult {
  ok: boolean;
  downloadUrl?: string;
  message?: string;
}

function getBaseUrl(): string {
  const url = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

/**
 * Rendert synchron mit Remotion auf dem Rechner, auf dem die App läuft —
 * gedacht für den lokalen Betrieb (voller CPU-Zugriff, kein Zeitlimit).
 * Auf Vercel ist der Button bewusst deaktiviert: die Hobby-Plan-CPU
 * schafft 4K-/HEVC-Material nicht (gemessen ~4% Echtzeit-Geschwindigkeit).
 */
export async function startRenderAction(conceptId: string): Promise<StartRenderResult> {
  const session = await requireSession();

  if (process.env.VERCEL) {
    return {
      ok: false,
      message:
        'Rendern ist in der Online-Version deaktiviert (zu wenig Server-CPU). Bitte die App dafür lokal starten — siehe README, Abschnitt "Lokal auf dem eigenen Rechner".',
    };
  }

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
  const clipIds = new Set(clips.map((clip) => clip.id));

  const missing = scenes.find((scene) => !clipIds.has(scene.clipId));
  if (missing) {
    return { ok: false, message: `Clip "${missing.clipName}" nicht gefunden — Drive neu synchronisieren?` };
  }

  const token = createRenderToken(session.accessToken);
  const baseUrl = getBaseUrl();

  const inputProps: ShotlistVideoProps = {
    caption: concept.caption,
    hashtags: concept.hashtags,
    scenes: scenes.map((scene) => ({
      order: scene.order,
      note: scene.note,
      timingSeconds: scene.timingSeconds,
      clipUrl: `${baseUrl}/api/clips/${scene.clipId}/media?token=${token}`,
    })),
  };

  try {
    const fileName = `${conceptId}-${Date.now()}.mp4`;
    const rendersDir = path.join(process.cwd(), "renders");
    await mkdir(rendersDir, { recursive: true });

    await renderShotlistVideo(inputProps, path.join(rendersDir, fileName));

    return { ok: true, downloadUrl: `/api/renders/${fileName}` };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unbekannter Fehler.";
    return { ok: false, message: `Render fehlgeschlagen: ${detail}` };
  }
}
