"use client";

import { useState, useTransition } from "react";

import { startRenderAction } from "@/app/dashboard/concepts/render-actions";
import { Button } from "@/components/ui/button";

export function RenderButton({ conceptId }: { conceptId: string }) {
  const [isPending, startTransition] = useTransition();
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleStart() {
    setErrorMessage(null);
    startTransition(async () => {
      try {
        const result = await startRenderAction(conceptId);
        if (result.ok && result.outputUrl) {
          setOutputUrl(result.outputUrl);
        } else {
          setErrorMessage(result.message ?? "Render konnte nicht gestartet werden.");
        }
      } catch {
        // Server-seitiger Abbruch ohne strukturierte Antwort (z.B. Vercel-
        // Funktions-Timeout bei sehr langen/großen Clips).
        setErrorMessage(
          "Render abgebrochen — vermutlich hat es zu lange gedauert (großes Rohmaterial). Kürzere Szenen-Timings oder kleinere Clips probieren."
        );
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={handleStart}>
          {isPending ? "Rendert…" : "Video rendern"}
        </Button>
        {isPending && (
          <span className="text-sm text-muted-foreground">Clips werden zusammengeschnitten…</span>
        )}
      </div>

      {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}

      {outputUrl && (
        <a
          href={outputUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-primary underline"
        >
          Video herunterladen
        </a>
      )}
    </div>
  );
}
