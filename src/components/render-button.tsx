"use client";

import { useState, useTransition } from "react";

import { startRenderAction } from "@/app/dashboard/concepts/render-actions";
import { Button } from "@/components/ui/button";

export function RenderButton({ conceptId }: { conceptId: string }) {
  const [isPending, startTransition] = useTransition();
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleStart() {
    setErrorMessage(null);
    startTransition(async () => {
      const result = await startRenderAction(conceptId);
      if (result.ok && result.downloadUrl) {
        setDownloadUrl(result.downloadUrl);
      } else {
        setErrorMessage(result.message ?? "Render konnte nicht gestartet werden.");
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
          <span className="text-sm text-muted-foreground">
            Rendert lokal mit Remotion — je nach Cliplänge ein paar Minuten…
          </span>
        )}
      </div>

      {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}

      {downloadUrl && (
        <a href={downloadUrl} className="text-sm font-medium text-primary underline">
          Video herunterladen
        </a>
      )}
    </div>
  );
}
