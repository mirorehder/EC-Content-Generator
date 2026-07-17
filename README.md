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
  Konzept-Generator lädt die ausgewählten Clips aus Drive, hängt sie per
  FFmpeg aneinander (vertikal auf 1080×1920 normalisiert, je Szene auf die
  Timing-Länge getrimmt) und brennt die Caption als Text-Overlay ein. Das
  fertige Video landet in Vercel Blob Storage und wird als Download-Link
  angezeigt. Kein AWS/Remotion nötig — bewusst einfach gehalten (kein
  Crossfade, keine aufwändigen Übergänge), siehe "Video-Rendering
  einrichten" unten.

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
   - `BLOB_READ_WRITE_TOKEN`: für die Rendering-Pipeline, nur lokal nötig —
     siehe "Video-Rendering einrichten" unten. Ohne diese Variable
     funktioniert die App weiterhin, der "Video rendern"-Button meldet dann
     nur, dass der Video-Speicher noch nicht konfiguriert ist.

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

Das Rendering (Clips aneinanderhängen + Caption einbrennen) läuft direkt in
einer Vercel Server Action mit FFmpeg (`@ffmpeg-installer/ffmpeg`, kein
externer Dienst nötig) und braucht nur einen Ort, um das fertige Video
abzulegen: **Vercel Blob Storage**.

1. Im Vercel-Dashboard: **Storage** → **Create Database** → **Blob** → mit
   diesem Projekt verknüpfen. Vercel setzt daraufhin automatisch
   `BLOB_STORE_ID` (+ einen automatisch verwalteten OIDC-Token zur
   Laufzeit) als Environment Variables im Projekt — kein AWS-Account,
   keine IAM-Policies, kein separates Deployment nötig. Ein Redeploy nach
   dem Verknüpfen ist nötig, damit die neuen Variablen greifen.
2. Für lokale Entwicklung (kein OIDC-Token vorhanden): im
   Blob-Store-Dashboard einen klassischen Read-Write-Token erzeugen und in
   `.env.local` als `BLOB_READ_WRITE_TOKEN` eintragen.

Danach funktioniert der "Video rendern"-Button im Konzept-Generator direkt:
Clips werden aus Drive geladen, auf 1080×1920 normalisiert, auf die
jeweilige Szenen-Länge getrimmt, aneinandergehängt und die Caption als
Text-Overlay eingebrannt (Font: DejaVu Sans Bold, liegt unter
`assets/fonts/`). Das Ergebnis wird nach Vercel Blob hochgeladen und als
Download-Link angezeigt.

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
