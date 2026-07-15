import { Readable } from "node:stream";

import { NextRequest, NextResponse } from "next/server";

import { getDriveMediaStream } from "@/lib/google-drive";
import { prisma } from "@/lib/prisma";

const RENDER_TOKEN_MAX_AGE_MS = 3 * 60 * 60 * 1000;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clipId: string }> }
) {
  const { clipId } = await params;
  const renderId = request.nextUrl.searchParams.get("renderId");

  if (!renderId) {
    return NextResponse.json({ error: "renderId fehlt." }, { status: 400 });
  }

  const [render, clip] = await Promise.all([
    prisma.render.findUnique({ where: { id: renderId } }),
    prisma.clip.findUnique({ where: { id: clipId } }),
  ]);

  if (!render || !clip) {
    return NextResponse.json({ error: "Render oder Clip nicht gefunden." }, { status: 404 });
  }

  if (Date.now() - render.createdAt.getTime() > RENDER_TOKEN_MAX_AGE_MS) {
    return NextResponse.json({ error: "Render-Zugriff abgelaufen." }, { status: 410 });
  }

  try {
    const media = await getDriveMediaStream(render.driveAccessToken, clip.driveFileId);
    const webStream = Readable.toWeb(
      media.stream as unknown as Readable
    ) as ReadableStream<Uint8Array>;

    return new NextResponse(webStream, {
      headers: {
        "Content-Type": media.mimeType,
        ...(media.contentLength ? { "Content-Length": media.contentLength } : {}),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Drive-Medienzugriff fehlgeschlagen." }, { status: 502 });
  }
}
