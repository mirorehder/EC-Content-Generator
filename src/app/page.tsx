import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { SignInButton } from "@/components/sign-in-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function Home() {
  const session = await auth();

  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">EdgeChase Content Generator</CardTitle>
          <CardDescription>
            Trend-Konzepte, Drive-Clips und Schnitt-Pipeline an einem Ort. Melde
            dich mit deinem Google-Konto an, um deinen Drive-Ordner zu verbinden.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignInButton />
        </CardContent>
      </Card>
    </main>
  );
}
