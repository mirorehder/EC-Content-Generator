"use client";

import { useActionState, useState, useTransition } from "react";

import {
  createConceptAction,
  generateCaptionSuggestionAction,
  type CreateConceptResult,
} from "@/app/dashboard/concepts/actions";
import { Button } from "@/components/ui/button";
import type { TrendFormat } from "@/lib/trend-formats";

interface ClipOption {
  id: string;
  name: string;
}

export function ConceptForm({
  trendFormats,
  clips,
}: {
  trendFormats: TrendFormat[];
  clips: ClipOption[];
}) {
  const [trendFormatId, setTrendFormatId] = useState(trendFormats[0]?.id ?? "");
  const [clipIds, setClipIds] = useState<string[]>([]);
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [isGenerating, startGenerating] = useTransition();

  const [result, formAction, isSaving] = useActionState<CreateConceptResult | null, FormData>(
    createConceptAction,
    null
  );

  function toggleClip(clipId: string) {
    setClipIds((prev) =>
      prev.includes(clipId) ? prev.filter((id) => id !== clipId) : [...prev, clipId]
    );
  }

  function handleGenerateSuggestion() {
    setAiMessage(null);
    startGenerating(async () => {
      const suggestion = await generateCaptionSuggestionAction(trendFormatId, clipIds);
      if (suggestion.ok) {
        setCaption(suggestion.caption ?? "");
        setHashtags((suggestion.hashtags ?? []).join(" "));
      } else {
        setAiMessage(suggestion.message ?? "KI-Vorschlag fehlgeschlagen.");
      }
    });
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div>
        <p className="mb-2 text-sm font-medium">Trend-Format</p>
        <div className="flex flex-col gap-1.5">
          {trendFormats.map((format) => (
            <label key={format.id} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="trendFormatId"
                value={format.id}
                checked={trendFormatId === format.id}
                onChange={() => setTrendFormatId(format.id)}
              />
              {format.title}
            </label>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Clips</p>
        {clips.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Noch keine Clips synchronisiert — zuerst im Drive-Sync-Bereich synchronisieren.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {clips.map((clip) => (
              <label key={clip.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="clipIds"
                  value={clip.id}
                  checked={clipIds.includes(clip.id)}
                  onChange={() => toggleClip(clip.id)}
                />
                {clip.name}
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label htmlFor="caption" className="text-sm font-medium">
            Caption
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isGenerating || !trendFormatId}
            onClick={handleGenerateSuggestion}
          >
            {isGenerating ? "Generiere…" : "KI-Vorschlag generieren"}
          </Button>
        </div>
        <textarea
          id="caption"
          name="caption"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={3}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {aiMessage && <p className="text-sm text-destructive">{aiMessage}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="hashtags" className="text-sm font-medium">
          Hashtags
        </label>
        <input
          id="hashtags"
          name="hashtags"
          value={hashtags}
          onChange={(e) => setHashtags(e.target.value)}
          placeholder="#edgechase #streetwear"
          className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? "Speichere…" : "Konzept speichern"}
        </Button>
        {result && (
          <p className={`text-sm ${result.ok ? "text-muted-foreground" : "text-destructive"}`}>
            {result.message}
          </p>
        )}
      </div>
    </form>
  );
}
