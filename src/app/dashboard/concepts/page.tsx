import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { ConceptForm } from "@/components/concept-form";
import { RenderButton } from "@/components/render-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { TREND_FORMATS } from "@/lib/trend-formats";
import type { ShotlistScene } from "./actions";

export default async function ConceptsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/");
  }

  const [clips, concepts] = await Promise.all([
    prisma.clip.findMany({ orderBy: { syncedAt: "desc" } }),
    prisma.concept.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
      <div>
        <Link href="/dashboard" className="text-sm text-muted-foreground hover:underline">
          ← Zurück zum Dashboard
        </Link>
        <h1 className="mt-2 text-xl font-semibold">Konzept-Generator</h1>
        <p className="text-sm text-muted-foreground">
          Trend-Format und Clips zu einer Shotlist verknüpfen.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Neues Konzept</CardTitle>
          <CardDescription>
            Format und Clips auswählen, optional per KI eine Caption vorschlagen lassen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConceptForm
            trendFormats={TREND_FORMATS}
            clips={clips.map((clip) => ({
              id: clip.id,
              name: clip.name,
              category: clip.category,
            }))}
          />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        {concepts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keine Konzepte gespeichert.</p>
        ) : (
          concepts.map((concept) => (
            <Card key={concept.id}>
              <CardHeader>
                <CardTitle className="text-base">{concept.trendTitle}</CardTitle>
                <CardDescription>{concept.caption}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <ol className="list-inside list-decimal space-y-1 text-sm">
                  {(concept.shotlist as unknown as ShotlistScene[]).map((scene) => (
                    <li key={scene.order}>
                      {scene.clipName} — {scene.note} ({scene.timingSeconds}s)
                    </li>
                  ))}
                </ol>
                {concept.hashtags.length > 0 && (
                  <p className="text-sm text-muted-foreground">{concept.hashtags.join(" ")}</p>
                )}
                <RenderButton conceptId={concept.id} />
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </main>
  );
}
