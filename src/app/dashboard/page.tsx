import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { SignOutButton } from "@/components/sign-out-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const UPCOMING_MODULES = [
  {
    title: "Drive-Sync",
    description: "Videos aus dem freigegebenen Google-Drive-Ordner lesen und als Clips listen.",
  },
  {
    title: "Trend-/Hook-Board",
    description: "Kuratierte Hook-Formate als Ausgangspunkt für neue Konzepte.",
  },
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
