import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TREND_FORMATS } from "@/lib/trend-formats";

export default async function TrendsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/");
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
      <div>
        <Link href="/dashboard" className="text-sm text-muted-foreground hover:underline">
          ← Zurück zum Dashboard
        </Link>
        <h1 className="mt-2 text-xl font-semibold">Trend-/Hook-Board</h1>
        <p className="text-sm text-muted-foreground">
          Kuratierte Format-Typen als Ausgangspunkt für den Konzept-Generator.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {TREND_FORMATS.map((format) => (
          <Card key={format.id}>
            <CardHeader>
              <CardTitle className="text-base">{format.title}</CardTitle>
              <CardDescription>&ldquo;{format.hook}&rdquo;</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <ol className="list-inside list-decimal space-y-1 text-sm text-foreground">
                {format.structure.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{format.timingSeconds}s</Badge>
                {format.tags.map((tag) => (
                  <Badge key={tag}>{tag}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
