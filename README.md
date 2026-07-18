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
  Konzept-Generator rendert mit **Remotion** (`remotion/ShotlistVideo.tsx`:
  1080×1920, Szenen mit Crossfade, Notiz- und Caption-Overlays — als
  React-Komponente frei gestaltbar). Die Clips streamt eine Proxy-Route
  aus Drive an den Renderer durch. Das ist für den **lokalen Betrieb auf
  dem eigenen Rechner** gedacht (siehe "Lokal auf dem eigenen Rechner"
  unten) — in der Vercel-Online-Version ist der Button deaktiviert, weil
  die Hobby-Plan-CPU für 4K-/HEVC-Material nicht reicht.

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
   Für das Video-Rendering sind keine weiteren Variablen nötig — Remotion
   wird über `npm install` automatisch mitinstalliert (siehe "Lokal auf
   dem eigenen Rechner" unten).

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

## Lokal auf dem eigenen Rechner

Die App ist dafür gedacht, **lokal auf dem eigenen PC/Mac zu laufen** — vor
allem wegen des Video-Renderings: Es braucht echte CPU-Leistung, die weder
Vercels Hobby-Plan (gemessen: ~4% Echtzeit-Geschwindigkeit bei 4K/HEVC)
noch der Browser-Tab (Speicher-Abstürze bei großen Rohdateien) zuverlässig
liefern. Lokal streamt FFmpeg die Clips direkt aus Drive und rendert ohne
Zeitlimit. Die Vercel-Version bleibt parallel nutzbar (z.B. mobil zum
Konzepte-Anlegen) — nur der Render-Button ist dort deaktiviert.

### Einmalige Einrichtung (Windows)

1. **Node.js installieren**: [nodejs.org](https://nodejs.org) → LTS-Version
   herunterladen und mit Standardeinstellungen installieren.
2. **Projekt herunterladen**: Auf der GitHub-Repo-Seite → grüner
   **Code**-Button → **Download ZIP** → entpacken (oder mit Git:
   `git clone https://github.com/mirorehder/EC-Content-Generator.git`).
3. **Terminal im Projektordner öffnen**: Im Explorer in den entpackten
   Ordner gehen → in die Adressleiste `cmd` tippen → Enter.
4. **Abhängigkeiten installieren**:

   ```bash
   npm install
   ```

5. **Umgebungsvariablen**: Die Datei `.env.example` in `.env.local`
   kopieren und die Werte eintragen — sie stehen alle schon im
   Vercel-Dashboard unter Project → Settings → Environment Variables
   (Werte per Auge-Symbol einblenden und kopieren). Wichtig:
   `NEXTAUTH_URL=http://localhost:3000` setzen (nicht die Vercel-URL).
   `DATABASE_URL` einfach identisch übernehmen — lokal und online nutzen
   dieselbe Datenbank, Konzepte und Clips sind also überall gleich.
6. **Google-Login für localhost freischalten**: [Google Cloud
   Console](https://console.cloud.google.com) → APIs & Dienste →
   Anmeldedaten → den OAuth-Client öffnen → bei **Autorisierte
   Weiterleitungs-URIs** zusätzlich eintragen:
   `http://localhost:3000/api/auth/callback/google`

### Starten (jedes Mal)

```bash
npm run dev
```

Dann [http://localhost:3000](http://localhost:3000) im Browser öffnen.
Beenden mit `Strg+C` im Terminal.

### Rendering-Details

Der "Video rendern"-Button rendert direkt auf dem Rechner mit Remotion:
Die Komposition (`remotion/ShotlistVideo.tsx`, 1080×1920, Crossfades,
Szenen-Notizen + Caption/Hashtags als Overlays) wird per Node-API
gebündelt und gerendert; die Clips streamt die Proxy-Route
`/api/clips/[clipId]/media` mit einem kurzlebigen Token aus Drive durch.
Das fertige Video landet im Ordner `renders/` und wird als Download-Link
angeboten.

Beim **allerersten Render** lädt Remotion einmalig einen eigenen
Headless-Chrome herunter (~150 MB) — das dauert einmal etwas länger,
danach nicht mehr.

Die Video-Gestaltung lässt sich interaktiv im Remotion Studio anpassen:

```bash
npm run remotion:studio   # Vorschau der Komposition im Browser
npm run remotion:render   # Test-Render mit Beispiel-Props nach out/video.mp4
```

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
