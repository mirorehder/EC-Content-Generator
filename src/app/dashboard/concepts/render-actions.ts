"use server";

import { put } from "@vercel/blob";
import { revalidatePath } from "next/cache";

import { renderShotlist } from "@/lib/ffmpeg-render";
import { prisma } from "@/lib/prisma";
import { requireSession, type ShotlistScene } from "./actions";

function isBlobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export interface StartRenderResult {
  ok: boolean;
  outputUrl?: string;
  message?: string;
}

export async function startRenderAction(conceptId: string): Promise<StartRenderResult> {
  const session = await requireSession();

  if (!isBlobConfigured()) {
    return {
      ok: false,
      message:
        "Video-Speicher (Vercel Blob) ist noch nicht eingerichtet. Siehe README, Abschnitt \"Video-Rendering einrichten\".",
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
  const driveFileIdByClipId = new Map(clips.map((clip) => [clip.id, clip.driveFileId]));

  try {
    const videoBuffer = await renderShotlist(
      session.accessToken,
      scenes.map((scene) => {
        const driveFileId = driveFileIdByClipId.get(scene.clipId);
        if (!driveFileId) throw new Error(`Clip ${scene.clipName} nicht gefunden.`);
        return { driveFileId, timingSeconds: scene.timingSeconds };
      }),
      `${concept.caption} ${concept.hashtags.join(" ")}`.trim()
    );

    const blob = await put(`renders/${conceptId}-${Date.now()}.mp4`, videoBuffer, {
      access: "public",
      contentType: "video/mp4",
    });

    await prisma.render.create({
      data: { conceptId, status: "done", outputUrl: blob.url },
    });

    revalidatePath("/dashboard/concepts");
    return { ok: true, outputUrl: blob.url };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unbekannter Fehler.";
    await prisma.render.create({
      data: { conceptId, status: "error", errorMessage: detail },
    });
    revalidatePath("/dashboard/concepts");
    return { ok: false, message: `Render fehlgeschlagen: ${detail}` };
  }
}
