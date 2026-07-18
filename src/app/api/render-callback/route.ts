import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";

interface RenderCallbackBody {
  renderId: string;
  status: "done" | "error";
  outputUrl?: string;
  errorMessage?: string;
}

/**
 * Called by the render.yml GitHub Actions workflow when it finishes (or
 * fails) rendering a shotlist — there's no other way back to the app from
 * a workflow run. Authenticated by a shared secret since it's an
 * unauthenticated public endpoint by necessity (GitHub Actions can't hold
 * a user session).
 */
export async function POST(request: Request) {
  const secret = process.env.RENDER_CALLBACK_SECRET;
  if (!secret || request.headers.get("X-Render-Secret") !== secret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as RenderCallbackBody;
  if (!body.renderId || !body.status) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  await prisma.render.update({
    where: { id: body.renderId },
    data:
      body.status === "done"
        ? { status: "done", outputUrl: body.outputUrl }
        : { status: "error", errorMessage: body.errorMessage },
  });

  revalidatePath("/dashboard/concepts");

  return Response.json({ ok: true });
}
