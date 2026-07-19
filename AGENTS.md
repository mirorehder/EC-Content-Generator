<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Projekt-Stand (Übergabe für neue Sessions)

EdgeChase Content Generator — Next.js-App für Kurzvideo-Konzepte einer
Parkour-/Streetwear-Marke. Der Besitzer (Miro) ist kein Programmierer:
Erklärungen einfach halten, Deutsch antworten, keine Secrets in Chat/Code.

## Architektur-Entscheidungen (bewusst so, nicht ändern ohne Grund)

- **Lokal-first**: Die App läuft primär per `npm run dev` auf dem PC des
  Besitzers. Vercel-Deployment existiert parallel (mobil, ohne Rendering).
  Grund: Video-Rendering braucht echte CPU — Vercel Hobby schaffte
  4K/HEVC nur mit ~4% Echtzeit, Browser-Rendering (MediaRecorder) stürzte
  bei großen Clips ab. Beide Wege wurden verworfen (siehe Git-History).
- **Rendering**: Remotion lokal via `@remotion/bundler` + `renderer`
  (`src/lib/remotion-render.ts`), Komposition in `remotion/ShotlistVideo.tsx`
  (1080×1920, Crossfades). Kein AWS/Lambda. Auf Vercel ist der Button
  per `process.env.VERCEL`-Guard deaktiviert. Clips streamt
  `/api/clips/[clipId]/media` mit kurzlebigem Token (`src/lib/render-tokens.ts`,
  globalThis-Store) aus Drive. Output → `renders/`, ausgeliefert über
  `/api/renders/[file]`.
- **KI = Google Gemini** (`gemini-flash-latest`-Alias, kostenloses
  Kontingent — Besitzer will keine bezahlte API). Immer `responseSchema`
  mitgeben (freies JSON kam kaputt zurück) und `withGeminiRetry` nutzen
  (503 bei freiem Kontingent häufig). Vision-Analyse cached pro Clip in
  `Clip.visionSummary` und wird per Ordner-Dropdown eingegrenzt.
- **NextAuth v5**: `clientId`/`clientSecret`/`secret` MÜSSEN explizit in
  `src/auth.ts` übergeben werden (Auto-Detection greift nur bei
  AUTH_*-Namen — war zweimal Ursache für Login-Totalausfall).
- **Prisma 7**: Driver-Adapter (`@prisma/adapter-pg`), `prisma db push`
  statt Migrationen, Client-Output in `src/generated/prisma`. Keine
  großen `$transaction`-Batches — 5s-Limit riss bei gehosteter DB
  (Neon, vermutlich US-Region); stattdessen Häppchen à 10 (siehe
  `syncDriveFolder`).
- **Drive-Sync** traversiert Unterordner (BFS); Ordnername landet als
  `Clip.category` und steuert Gruppierung + KI-Ordner-Filter.

## Offene Punkte

- Trend-Formate in `src/lib/trend-formats.ts` sind generische Platzhalter
  — Besitzer wünscht kuratierte Parkour-/Streetwear-Hook-Formate.
- Instagram-Anbindung (gespeicherte Videos analysieren) — Idee, zurückgestellt.
- Overlays der Remotion-Komposition überlappen in den letzten ~2s leicht
  (Caption über Szenen-Notiz) — Feinschliff via `npm run remotion:studio`.

## Verifizieren

`npm run lint` und `npx next build` müssen sauber sein. Rendering-Änderungen
end-to-end testen (Testclips + lokaler Range-Server, siehe Git-History der
e2e-Tests). Nach Paket-Änderungen: Besitzer braucht Hinweis auf `npm install`.
