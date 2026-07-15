"use client";

import { useEffect, useRef, useState } from "react";

import {
  getRenderStatusAction,
  startRenderAction,
  type RenderState,
} from "@/app/dashboard/concepts/render-actions";
import { Button } from "@/components/ui/button";

const POLL_INTERVAL_MS = 3000;

export function RenderButton({ conceptId }: { conceptId: string }) {
  const [render, setRender] = useState<RenderState | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [startMessage, setStartMessage] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function startPolling(renderId: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const state = await getRenderStatusAction(renderId);
      if (!state) return;
      setRender(state);
      if (state.status === "done" || state.status === "error") {
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, POLL_INTERVAL_MS);
  }

  async function handleStart() {
    setIsStarting(true);
    setStartMessage(null);
    const result = await startRenderAction(conceptId);
    setIsStarting(false);

    if (!result.ok || !result.renderId) {
      setStartMessage(result.message ?? "Render konnte nicht gestartet werden.");
      return;
    }

    setRender({ id: result.renderId, status: "pending", progress: 0, outputUrl: null, errorMessage: null });
    startPolling(result.renderId);
  }

  const isActive = render && (render.status === "pending" || render.status === "rendering");

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" size="sm" disabled={isStarting || !!isActive} onClick={handleStart}>
          {isActive ? "Rendert…" : "Video rendern"}
        </Button>
        {isActive && (
          <span className="text-sm text-muted-foreground">
            {Math.round(render.progress * 100)}%
          </span>
        )}
      </div>

      {startMessage && <p className="text-sm text-destructive">{startMessage}</p>}

      {render?.status === "error" && (
        <p className="text-sm text-destructive">{render.errorMessage}</p>
      )}

      {render?.status === "done" && render.outputUrl && (
        <a
          href={render.outputUrl}
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
