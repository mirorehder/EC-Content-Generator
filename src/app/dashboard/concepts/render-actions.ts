"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { checkLambdaRenderProgress, isLambdaConfigured, triggerLambdaRender } from "@/lib/remotion-lambda";
import type { ShotlistVideoProps } from "../../../../remotion/ShotlistVideo";
import { requireSession, type ShotlistScene } from "./actions";

function getBaseUrl(): string {
  const url = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

export interface RenderState {
  id: string;
  status: string;
  progress: number;
  outputUrl: string | null;
  errorMessage: string | null;
}

function toRenderState(render: {
  id: string;
  status: string;
  progress: number;
  outputUrl: string | null;
  errorMessage: string | null;
}): RenderState {
  return {
    id: render.id,
    status: render.status,
    progress: render.progress,
    outputUrl: render.outputUrl,
    errorMessage: render.errorMessage,
  };
}

export interface StartRenderResult {
  ok: boolean;
  renderId?: string;
  message?: string;
}

export async function startRenderAction(conceptId: string): Promise<StartRenderResult> {
  const session = await requireSession();

  if (!isLambdaConfigured()) {
    return {
      ok: false,
      message:
        "Remotion Lambda ist noch nicht eingerichtet. Siehe README für die Deployment-Schritte (npx remotion lambda ...).",
    };
  }

  if (!session.accessToken) {
    return { ok: false, message: "Kein Google-Zugriffstoken vorhanden. Bitte neu anmelden." };
  }

  const concept = await prisma.concept.findUnique({ where: { id: conceptId } });
  if (!concept) {
    return { ok: false, message: "Konzept nicht gefunden." };
  }

  const render = await prisma.render.create({
    data: {
      conceptId,
      status: "pending",
      driveAccessToken: session.accessToken,
    },
  });

  const baseUrl = getBaseUrl();
  const scenes = concept.shotlist as unknown as ShotlistScene[];

  const inputProps: ShotlistVideoProps = {
    caption: concept.caption,
    hashtags: concept.hashtags,
    scenes: scenes.map((scene) => ({
      order: scene.order,
      note: scene.note,
      timingSeconds: scene.timingSeconds,
      clipUrl: `${baseUrl}/api/clips/${scene.clipId}/media?renderId=${render.id}`,
    })),
  };

  try {
    const { renderId, bucketName } = await triggerLambdaRender(inputProps);
    await prisma.render.update({
      where: { id: render.id },
      data: { status: "rendering", remotionRenderId: renderId, bucketName },
    });
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

export async function getRenderStatusAction(renderId: string): Promise<RenderState | null> {
  await requireSession();

  const render = await prisma.render.findUnique({ where: { id: renderId } });
  if (!render) return null;

  if (render.status === "done" || render.status === "error") {
    return toRenderState(render);
  }

  if (!render.remotionRenderId || !render.bucketName) {
    return toRenderState(render);
  }

  try {
    const progress = await checkLambdaRenderProgress(render.remotionRenderId, render.bucketName);

    const updated = await prisma.render.update({
      where: { id: render.id },
      data: progress.fatalErrorEncountered
        ? {
            status: "error",
            errorMessage: progress.errors[0]?.message ?? "Rendering fehlgeschlagen.",
          }
        : progress.done
          ? { status: "done", outputUrl: progress.outputFile, progress: 1 }
          : { status: "rendering", progress: progress.overallProgress },
    });

    return toRenderState(updated);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unbekannter Fehler.";
    const updated = await prisma.render.update({
      where: { id: render.id },
      data: { status: "error", errorMessage: detail },
    });
    return toRenderState(updated);
  }
}
