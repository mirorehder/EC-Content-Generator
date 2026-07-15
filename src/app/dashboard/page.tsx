import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { SignOutButton } from "@/components/sign-out-button";
import { SyncClipsForm } from "@/components/sync-clips-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDuration } from "@/lib/format";
import { prisma } from "@/lib/prisma";

const UPCOMING_MODULES = [
  {
    title: "Konzept-Generator",
    description: "Trend-Format + Clips zu einer strukturierten Shotlist verknüpfen.",
  },
  {
    title: "Rendering-Pipeline",
    description: "Shotlist per Remotion Lambda rendern und den Download bereitstellen.",
  },
];

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/");
  }

  const clips = await prisma.clip.findMany({ orderBy: { syncedAt: "desc" } });

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
            <ul className="grid gap-3 sm:grid-cols-2">
              {clips.map((clip) => (
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
                    <p className="text-xs text-muted-foreground">{formatDuration(clip.durationMs)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Link href="/dashboard/trends">
        <Card className="transition-colors hover:bg-accent">
          <CardHeader>
            <CardTitle className="text-base">Trend-/Hook-Board</CardTitle>
            <CardDescription>
              Kuratierte Hook-Formate als Ausgangspunkt für neue Konzepte.
            </CardDescription>
          </CardHeader>
        </Card>
      </Link>

      <div className="grid gap-4 sm:grid-cols-2">
        {UPCOMING_MODULES.map((module) => (
          <Card key={module.title}>
            <CardHeader>
              <CardTitle className="text-base">{module.title}</CardTitle>
              <CardDescription>{module.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </main>
  );
}
