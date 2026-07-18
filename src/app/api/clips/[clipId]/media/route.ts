import { getDriveMediaStream } from "@/lib/google-drive";
import { prisma } from "@/lib/prisma";
import { resolveRenderToken } from "@/lib/render-tokens";

/**
 * Reicht Clip-Videodaten aus Drive an Remotions Headless-Chrome durch —
 * das hat keine Session, deshalb autorisiert ein kurzlebiger Render-Token
 * (von startRenderAction erzeugt) statt des Logins.
 */
export async function GET(req: Request, ctx: RouteContext<"/api/clips/[clipId]/media">) {
  const token = new URL(req.url).searchParams.get("token");
  const driveAccessToken = token ? resolveRenderToken(token) : null;
  if (!driveAccessToken) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clipId } = await ctx.params;
  const clip = await prisma.clip.findUnique({ where: { id: clipId } });
  if (!clip) {
    return Response.json({ error: "Clip not found" }, { status: 404 });
  }

  const media = await getDriveMediaStream(driveAccessToken, clip.driveFileId);

  const headers = new Headers({ "Content-Type": media.mimeType });
  if (media.contentLength) headers.set("Content-Length", media.contentLength);

  return new Response(
    new ReadableStream({
      start(controller) {
        media.stream.on("data", (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
        media.stream.on("end", () => controller.close());
        media.stream.on("error", (err: Error) => controller.error(err));
      },
    }),
    { headers }
  );
}
