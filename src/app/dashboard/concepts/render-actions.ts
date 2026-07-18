"use server";

import { revalidatePath } from "next/cache";

import { isGithubRenderConfigured, triggerGithubRender } from "@/lib/github-render";
import { prisma } from "@/lib/prisma";
import { requireSession, type ShotlistScene } from "./actions";

export interface StartRenderResult {
  ok: boolean;
  renderId?: string;
  message?: string;
}

export async function startRenderAction(conceptId: string): Promise<StartRenderResult> {
  const session = await requireSession();

  if (!isGithubRenderConfigured()) {
    return {
      ok: false,
      message:
        'Video-Rendering ist noch nicht eingerichtet. Siehe README, Abschnitt "Video-Rendering einrichten".',
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

  const renderScenes = scenes.map((scene) => {
    const driveFileId = driveFileIdByClipId.get(scene.clipId);
    if (!driveFileId) throw new Error(`Clip ${scene.clipName} nicht gefunden.`);
    return { driveFileId, timingSeconds: scene.timingSeconds };
  });

  const render = await prisma.render.create({
    data: { conceptId, status: "pending" },
  });

  try {
    await triggerGithubRender(
      render.id,
      session.accessToken,
      renderScenes,
      `${concept.caption} ${concept.hashtags.join(" ")}`.trim()
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unbekannter Fehler.";
    await prisma.render.update({
      where: { id: render.id },
      data: { status: "error", errorMessage: detail },
    });
    return { ok: false, message: `Render konnte nicht gestartet werden: ${detail}` };
  }

  revalidatePath("/dashboard/concepts");
  return { ok: true, renderId: render.id };
}

export interface RenderState {
  id: string;
  status: string;
  outputUrl: string | null;
  errorMessage: string | null;
}

export async function getRenderStatusAction(renderId: string): Promise<RenderState | null> {
  await requireSession();

  const render = await prisma.render.findUnique({ where: { id: renderId } });
  if (!render) return null;

  return {
    id: render.id,
    status: render.status,
    outputUrl: render.outputUrl,
    errorMessage: render.errorMessage,
  };
}
