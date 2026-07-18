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
  Konzept-Generator schneidet das Video **direkt im Browser** zusammen
  (`src/lib/browser-render.ts`): Die Clips werden mit dem eigenen
  Google-Zugriffstoken von Drive geladen, in unsichtbaren `<video>`-
  Elementen abgespielt (nutzt den Hardware-Decoder des Geräts), auf ein
  1080×1920-Canvas gezeichnet (Cover-Crop, Caption-Overlay) und per
  MediaRecorder aufgezeichnet. Das fertige Video wird direkt als Datei
  heruntergeladen — kein Server, kein Hosting, kein Setup. Details und
  Einschränkungen siehe "Video-Rendering" unten.

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
   Für das Video-Rendering sind keine weiteren Variablen nötig — es läuft
   komplett im Browser (siehe "Video-Rendering" unten).

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

## Video-Rendering

Das Schneiden läuft **komplett im Browser** — es gibt nichts einzurichten
(kein AWS, kein Blob-Store, keine Tokens). Hintergrund: Serverseitiges
Rendern auf Vercels Hobby-Plan scheiterte an der schwachen CPU-Zuteilung
(4K-/HEVC-Material von iPhones lief dort mit ~4% der
Echtzeit-Geschwindigkeit). Das eigene Gerät hat dagegen einen
Hardware-Decoder für genau die Videos, die es selbst aufgenommen hat.

Ablauf beim Klick auf "Video rendern":

1. Eine Server Action liefert Szenenliste + das eigene Google-Zugriffstoken.
2. Der Browser lädt die Clips damit direkt von Drive herunter.
3. Jeder Clip wird in einem unsichtbaren `<video>` abgespielt, auf ein
   1080×1920-Canvas gezeichnet (Cover-Crop auf Hochformat, Caption als
   Text-Overlay) und per MediaRecorder aufgezeichnet; die Tonspuren werden
   über WebAudio mitgeschnitten.
4. Das fertige Video wird als Datei zum Speichern angeboten.

Einschränkungen, bewusst in Kauf genommen:

- Die Aufnahme läuft in **Echtzeit** — ein 16-Sekunden-Video braucht ~16
  Sekunden. Der Tab muss dabei offen und im Vordergrund bleiben.
- Das Ausgabeformat hängt vom Browser ab: iPhone/Safari und aktuelles
  Chrome erzeugen MP4, ältere Browser WebM (das Instagram nicht direkt
  akzeptiert).
- Lange Rohclips werden komplett heruntergeladen, auch wenn nur die ersten
  Sekunden gebraucht werden — die Clips im Drive-Ordner daher eher kurz
  halten.
- Blockiert der Browser unstummes Abspielen (mobile Autoplay-Regeln),
  rendert der Clip stumm weiter statt abzubrechen.

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
