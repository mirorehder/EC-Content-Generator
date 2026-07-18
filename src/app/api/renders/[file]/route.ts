import { readFile } from "node:fs/promises";
import path from "node:path";

import { auth } from "@/auth";

// Liefert fertig gerenderte Videos aus dem lokalen renders/-Ordner aus.
const FILE_NAME_PATTERN = /^[a-z0-9]+-\d+\.mp4$/;

export async function GET(_req: Request, ctx: RouteContext<"/api/renders/[file]">) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { file } = await ctx.params;
  if (!FILE_NAME_PATTERN.test(file)) {
    return Response.json({ error: "Invalid file name" }, { status: 400 });
  }

  try {
    const buffer = await readFile(path.join(process.cwd(), "renders", file));
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="${file}"`,
      },
    });
  } catch {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
}
