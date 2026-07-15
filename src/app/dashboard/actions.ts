"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { listVideoFiles } from "@/lib/google-drive";
import { prisma } from "@/lib/prisma";

export interface SyncResult {
  ok: boolean;
  message: string;
  syncedCount?: number;
}

export async function syncDriveFolder(
  _prevState: SyncResult | null,
  formData: FormData
): Promise<SyncResult> {
  const session = await auth();

  if (!session?.accessToken) {
    return { ok: false, message: "Nicht angemeldet oder kein Google-Zugriffstoken vorhanden." };
  }

  const folderId = (formData.get("folderId") as string | null)?.trim();

  if (!folderId) {
    return { ok: false, message: "Bitte eine Drive-Ordner-ID angeben." };
  }

  try {
    const files = await listVideoFiles(session.accessToken, folderId);

    await prisma.$transaction(
      files.map((file) =>
        prisma.clip.upsert({
          where: { driveFileId: file.id },
          create: {
            driveFileId: file.id,
            name: file.name,
            mimeType: file.mimeType,
            durationMs: file.durationMs,
            thumbnailLink: file.thumbnailLink,
            webViewLink: file.webViewLink,
          },
          update: {
            name: file.name,
            mimeType: file.mimeType,
            durationMs: file.durationMs,
            thumbnailLink: file.thumbnailLink,
            webViewLink: file.webViewLink,
          },
        })
      )
    );

    revalidatePath("/dashboard");

    return {
      ok: true,
      message: `${files.length} Video${files.length === 1 ? "" : "s"} synchronisiert.`,
      syncedCount: files.length,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unbekannter Fehler.";
    return { ok: false, message: `Drive-Sync fehlgeschlagen: ${detail}` };
  }
}
