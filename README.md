# EdgeChase Content Generator

Next.js-App, die (1) Trend-/Hook-Konzepte aufbereitet, (2) Videos aus einem
Google-Drive-Ordner liest und (3) daraus eine Schnitt-/Rendering-Pipeline
anstößt. Siehe der ursprünglichen Architektur-Spezifikation für den vollen
Umfang.

## Status

Aktuell umgesetzt:

- **Schritt 1** — Next.js App Router Projekt (TypeScript, Tailwind v4),
  Google-Login via NextAuth (Auth.js v5) mit `drive.readonly`-Scope inkl.
  Refresh-Token-Handling, geschützte `/dashboard`-Route, shadcn/ui-Grundkomponenten
  (`Button`, `Card`)
- **Schritt 2** — Drive-Sync: liest Videos aus einem freigegebenen
  Google-Drive-Ordner (`drive.files.list`, gefiltert auf `mimeType contains
  'video/'`) und speichert nur die Metadaten (Datei-ID, Name, Dauer,
  Thumbnail-Link) via Prisma in Postgres — keine Videodateien selbst
- **Schritt 3** — Trend-/Hook-Board: kuratierte, statische Liste von
  Hook-Formaten (Hook-Text, Szenen-Struktur, Timing, Tags) unter
  `/dashboard/trends` — aktuell mit Platzhalter-Daten, siehe Hinweis unten
- **Schritt 4** — Konzept-Generator: verknüpft ein Trend-Format mit
  ausgewählten Clips zu einer Shotlist (JSON: Szenen, Timing, Caption,
  Hashtags) unter `/dashboard/concepts`. Optional generiert die Gemini
  API (`gemini-2.5-flash`) einen Caption-/Hook-Vorschlag im EdgeChase-Ton —
  ohne `GEMINI_API_KEY` bleibt das Feld einfach manuell ausfüllbar.
  Zusätzlich: "Passende Clips vorschlagen" analysiert die Vorschaubilder
  noch nicht analysierter Clips per Gemini Vision (Ergebnis wird pro Clip
  in `visionSummary` gecacht) und schlägt darauf basierend eine passende
  Clip-Auswahl zum gewählten Hook-Format vor.
- **Schritt 5** — Rendering-Pipeline: Der "Video rendern"-Button im
  Konzept-Generator stößt einen GitHub-Actions-Workflow
  (`.github/workflows/render.yml`) an, der die ausgewählten Clips aus Drive
  lädt, per FFmpeg aneinanderhängt (vertikal auf 1080×1920 normalisiert, je
  Szene auf die Timing-Länge getrimmt), die Caption als Text-Overlay
  einbrennt und das Ergebnis nach Vercel Blob Storage hochlädt. Das Rendern
  läuft bewusst *nicht* in der Vercel-Funktion selbst — Vercels Hobby-Plan
  gibt Functions zu wenig CPU, um 4K-/HEVC-Rohmaterial (typisch bei
  iPhone-Aufnahmen) in vertretbarer Zeit zu dekodieren; ein
  GitHub-Actions-Runner hat dafür genug Leistung. Details und Setup siehe
  "Video-Rendering einrichten" unten.

Alle fünf Schritte aus der Architektur-Spezifikation sind damit im Code
umgesetzt.

> Die Trend-Formate in `src/lib/trend-formats.ts` sind ein generisches
> Platzhalter-Startset, keine echte Recherche — dort direkt ersetzen, sobald
> die eigentlichen Trend-Daten vorliegen.

## Lokale Einrichtung

1. Abhängigkeiten installieren:

   ```bash
   npm install
   ```

2. `.env.example` nach `.env.local` kopieren und Werte eintragen:

   ```bash
   cp .env.example .env.local
   ```

   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: aus der Google Cloud
     Console (OAuth-Client, Redirect-URI
     `http://localhost:3000/api/auth/callback/google` für lokale Entwicklung).
   - `NEXTAUTH_SECRET`: generieren mit `npx auth secret`.
   - `NEXTAUTH_URL`: `http://localhost:3000` lokal, Produktions-Domain auf
     Vercel.
   - `DATABASE_URL`: Connection-String einer Postgres-Instanz (Vercel Postgres
     oder Supabase funktionieren beide, da Prisma nur einen Standard-Postgres-
     Connection-String braucht).
   - `DRIVE_FOLDER_ID`: die ID des freigegebenen Google-Drive-Ordners (aus der
     Freigabe-URL, z. B. `https://drive.google.com/drive/folders/<ID>`).
   - `GEMINI_API_KEY`: optional, für die KI-Caption-Vorschläge und das
     Vision-basierte Clip-Matching im Konzept-Generator. Kostenloser Key ohne
     Kreditkarte (Stand: Erstellung dieses Dokuments) unter
     [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Ohne
     Key funktioniert der Konzept-Generator trotzdem (Caption/Hashtags/Clips
     einfach manuell eintragen bzw. auswählen).
   - `RENDER_GITHUB_TOKEN`, `GITHUB_REPO_OWNER`, `GITHUB_REPO_NAME`,
     `RENDER_CALLBACK_SECRET`: für die Rendering-Pipeline — siehe
     "Video-Rendering einrichten" unten. Ohne diese Variablen funktioniert
     die App weiterhin, der "Video rendern"-Button meldet dann nur, dass
     das Rendering noch nicht konfiguriert ist.

3. Datenbank-Schema anwenden:

   ```bash
   npx prisma db push
   ```

   Das gleicht Postgres direkt mit `prisma/schema.prisma` ab (kein
   Migrationsverlauf, passend für ein Solo-/Kleinteam-Projekt in dieser
   Phase). Der Build-Schritt (`npm run build`, auch auf Vercel) führt das
   automatisch mit aus — lokal reicht ein einmaliges Ausführen.

4. Dev-Server starten:

   ```bash
   npm run dev
   ```

   [http://localhost:3000](http://localhost:3000) öffnen. Login leitet nach
   `/dashboard` weiter. Dort lässt sich über die Ordner-ID + "Jetzt
   synchronisieren" der Drive-Sync manuell auslösen.

## Video-Rendering einrichten

Das eigentliche FFmpeg-Rendern läuft **nicht** in der Vercel-Funktion,
sondern in einem GitHub-Actions-Workflow (`.github/workflows/render.yml`):
Vercels Hobby-Plan gibt Functions zu wenig CPU, um 4K-/HEVC-Rohmaterial
(z.B. iPhone-Aufnahmen) in vertretbarer Zeit zu dekodieren — ein normaler
GitHub-Actions-Runner (2 vCPUs) schafft das ohne Weiteres.

Ablauf: Der "Video rendern"-Button löst per GitHub-API einen
`workflow_dispatch` aus → der Workflow lädt die Clips direkt von Drive,
rendert mit FFmpeg, lädt das Ergebnis nach Vercel Blob hoch und meldet sich
über einen Webhook (`/api/render-callback`) mit dem Ergebnis zurück. Die
Konzept-Seite pollt den Status, bis er fertig ist.

Setup (einmalig, alles in GitHub/Vercel, kein AWS):

1. **GitHub Personal Access Token** erzeugen: GitHub → Profilbild →
   **Settings** → **Developer settings** → **Personal access tokens** →
   **Tokens (classic)** → **Generate new token**. Scope: `repo` (bei
   privatem Repo nötig) + `workflow`. Token kopieren.
2. **Vercel-Dashboard** → dieses Projekt → **Settings** → **Environment
   Variables** → folgende hinzufügen:
   - `RENDER_GITHUB_TOKEN`: der Token aus Schritt 1
   - `GITHUB_REPO_OWNER`: `mirorehder`
   - `GITHUB_REPO_NAME`: `EC-Content-Generator`
   - `RENDER_CALLBACK_SECRET`: ein beliebiger langer Zufallsstring (z.B.
     mit `openssl rand -hex 32` erzeugen) — dient nur dazu, dass der
     Callback-Endpunkt Aufrufe von GitHub Actions erkennt und keine
     fremden.
3. **GitHub-Repo** → **Settings** → **Secrets and variables** →
   **Actions** → **New repository secret**, dreimal:
   - `BLOB_READ_WRITE_TOKEN`: klassischer Token aus dem
     Blob-Store-Dashboard (Storage → Blob-Store → "Create token", **nicht**
     der OIDC-Automatismus — Actions-Runner sind kein Vercel-Kontext)
   - `RENDER_CALLBACK_SECRET`: **derselbe** Wert wie in Schritt 2
   - `APP_URL`: die Produktions-URL der App (z.B.
     `https://ec-content-generator.vercel.app`, ohne Slash am Ende)
4. Redeploy auf Vercel, damit die neuen Variablen greifen.

Danach funktioniert der "Video rendern"-Button: Clips werden aus Drive
geladen, auf 1080×1920 normalisiert, auf die jeweilige Szenen-Länge
getrimmt, aneinandergehängt und die Caption als Text-Overlay eingebrannt
(Font: DejaVu Sans Bold, liegt unter `assets/fonts/`). Fortschritt lässt
sich auch direkt im GitHub-Repo unter **Actions** mitverfolgen.

**Bekannte Einschränkung:** Es wird angenommen, dass jeder Clip eine
Audiospur hat (bei echtem Kamera-/Handymaterial praktisch immer der Fall).
Ein komplett stummer Clip lässt den Render mit einer klaren FFmpeg-Fehler-
meldung fehlschlagen statt automatisch auf Video-only umzuschalten.

## Deployment

Auf Vercel deployen und dieselben Variablen aus `.env.example` im
Vercel-Dashboard (Project Settings → Environment Variables) hinterlegen.
Secrets niemals im Code oder Chat teilen.

Der Prisma Client wird bei jedem `npm install` automatisch neu generiert
(`postinstall`-Script). Das Datenbankschema wird bei jedem Build automatisch
per `prisma db push` mit der in `DATABASE_URL` hinterlegten Postgres-Instanz
abgeglichen (Teil des `build`-Scripts) — dafür muss `DATABASE_URL` in Vercel
bereits gesetzt sein, *bevor* der erste Build läuft.

## Weitere Befehle

```bash
npm run build   # Produktions-Build
npm run lint    # ESLint
```
