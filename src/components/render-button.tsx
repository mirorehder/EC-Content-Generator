"use client";

import { useEffect, useRef, useState } from "react";

import { getRenderJobAction } from "@/app/dashboard/concepts/render-actions";
import { renderShotlistInBrowser } from "@/lib/browser-render";
import { Button } from "@/components/ui/button";

type Phase =
  | { name: "idle" }
  | { name: "loading"; loaded: number; total: number }
  | { name: "rendering"; fraction: number }
  | { name: "done"; url: string; fileName: string }
  | { name: "error"; message: string };

function driveMediaUrl(driveFileId: string): string {
  return `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFileId)}?alt=media`;
}

export function RenderButton({ conceptId }: { conceptId: string }) {
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const objectUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    const urls = objectUrlsRef.current;
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, []);

  async function handleStart() {
    setPhase({ name: "loading", loaded: 0, total: 0 });

    try {
      const job = await getRenderJobAction(conceptId);
      if (!job.ok || !job.accessToken || !job.scenes) {
        setPhase({ name: "error", message: job.message ?? "Render konnte nicht gestartet werden." });
        return;
      }

      setPhase({ name: "loading", loaded: 0, total: job.scenes.length });

      const clipUrls: string[] = [];
      for (const [i, scene] of job.scenes.entries()) {
        const res = await fetch(driveMediaUrl(scene.driveFileId), {
          headers: { Authorization: `Bearer ${job.accessToken}` },
        });
        if (!res.ok) {
          throw new Error(`Clip "${scene.clipName}" konnte nicht von Drive geladen werden (${res.status}).`);
        }
        const url = URL.createObjectURL(await res.blob());
        clipUrls.push(url);
        objectUrlsRef.current.push(url);
        setPhase({ name: "loading", loaded: i + 1, total: job.scenes.length });
      }

      setPhase({ name: "rendering", fraction: 0 });

      const result = await renderShotlistInBrowser({
        scenes: job.scenes.map((scene, i) => ({
          url: clipUrls[i],
          timingSeconds: scene.timingSeconds,
        })),
        caption: job.caption ?? "",
        onProgress: (fraction) => setPhase({ name: "rendering", fraction }),
      });

      const outputUrl = URL.createObjectURL(result.blob);
      objectUrlsRef.current.push(outputUrl);
      setPhase({
        name: "done",
        url: outputUrl,
        fileName: `${job.fileBaseName || "edgechase-video"}.${result.extension}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unbekannter Fehler.";
      setPhase({ name: "error", message });
    }
  }

  const isBusy = phase.name === "loading" || phase.name === "rendering";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" size="sm" disabled={isBusy} onClick={handleStart}>
          {isBusy ? "Rendert…" : "Video rendern"}
        </Button>
        {phase.name === "loading" && (
          <span className="text-sm text-muted-foreground">
            {phase.total > 0
              ? `Clips laden… (${phase.loaded}/${phase.total})`
              : "Vorbereiten…"}
          </span>
        )}
        {phase.name === "rendering" && (
          <span className="text-sm text-muted-foreground">
            Schneidet im Browser… {Math.round(phase.fraction * 100)}% — Tab offen lassen
          </span>
        )}
      </div>

      {phase.name === "error" && <p className="text-sm text-destructive">{phase.message}</p>}

      {phase.name === "done" && (
        <a
          href={phase.url}
          download={phase.fileName}
          className="text-sm font-medium text-primary underline"
        >
          Video speichern ({phase.fileName})
        </a>
      )}
    </div>
  );
}
