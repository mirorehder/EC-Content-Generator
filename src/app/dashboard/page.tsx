import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { SignOutButton } from "@/components/sign-out-button";
import { SyncClipsForm } from "@/components/sync-clips-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDuration } from "@/lib/format";
import { prisma } from "@/lib/prisma";

type ClipRow = Awaited<ReturnType<typeof prisma.clip.findMany>>[number];

function groupClipsByFolder(clips: ClipRow[]): [string, ClipRow[]][] {
  const groups = new Map<string, ClipRow[]>();
  for (const clip of clips) {
    const key = clip.category ?? "Ohne Ordner";
    const list = groups.get(key) ?? [];
    list.push(clip);
    groups.set(key, list);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, "de"));
}

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/");
  }

  const clips = await prisma.clip.findMany({ orderBy: { name: "asc" } });
  const clipsByFolder = groupClipsByFolder(clips);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Willkommen, {session.user.name ?? "bei EdgeChase"}</h1>
          <p className="text-sm text-muted-foreground">{session.user.email}</p>
        </div>
        <SignOutButton />
      </div>

      {session.error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-6 text-sm text-destructive">
            Google-Zugriff konnte nicht erneuert werden. Bitte melde dich erneut an, um
            den Drive-Zugriff wiederherzustellen.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Drive-Sync</CardTitle>
          <CardDescription>
            Videos aus einem freigegebenen Google-Drive-Ordner lesen. Es werden nur Metadaten
            gespeichert, keine Videodateien.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <SyncClipsForm defaultFolderId={process.env.DRIVE_FOLDER_ID ?? ""} />

          {clips.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Noch keine Clips synchronisiert.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {clipsByFolder.map(([folder, folderClips]) => (
                <details key={folder} className="rounded-md border border-border">
                  <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium">
                    {folder}{" "}
                    <span className="text-muted-foreground">({folderClips.length})</span>
                  </summary>
                  <ul className="grid gap-3 px-3 pb-3 sm:grid-cols-2">
                    {folderClips.map((clip) => (
                      <li key={clip.id} className="flex gap-3 rounded-md border border-border p-2">
                        {clip.thumbnailLink ? (
                          // eslint-disable-next-line @next/next/no-img-element -- external Drive thumbnail URL, not a local asset
                          <img
                            src={clip.thumbnailLink}
                            alt={clip.name}
                            width={80}
                            height={45}
                            className="h-[45px] w-20 shrink-0 rounded object-cover"
                          />
                        ) : (
                          <div className="h-[45px] w-20 shrink-0 rounded bg-muted" />
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{clip.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDuration(clip.durationMs)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/dashboard/trends">
          <Card className="h-full transition-colors hover:bg-accent">
            <CardHeader>
              <CardTitle className="text-base">Trend-/Hook-Board</CardTitle>
              <CardDescription>
                Kuratierte Hook-Formate als Ausgangspunkt für neue Konzepte.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/dashboard/concepts">
          <Card className="h-full transition-colors hover:bg-accent">
            <CardHeader>
              <CardTitle className="text-base">Konzept-Generator</CardTitle>
              <CardDescription>
                Trend-Format + Clips zu einer strukturierten Shotlist verknüpfen.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>

    </main>
  );
}
