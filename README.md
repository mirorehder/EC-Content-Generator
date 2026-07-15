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
  Hashtags) unter `/dashboard/concepts`. Optional generiert die Anthropic
  API (`claude-opus-4-8`) einen Caption-/Hook-Vorschlag im EdgeChase-Ton —
  ohne `ANTHROPIC_API_KEY` bleibt das Feld einfach manuell ausfüllbar.
- **Schritt 5** — Rendering-Pipeline: `remotion/ShotlistVideo.tsx` ist eine
  eigenständige Remotion-Komposition (1080×1920, Szenen mit Crossfade +
  Caption-Overlay), lokal isoliert getestet und gerendert (siehe
  "Remotion lokal testen" unten). Ein "Video rendern"-Button im
  Konzept-Generator stößt den Render über Remotion Lambda an (AWS,
  umgeht die Vercel-Function-Zeitgrenze) und zeigt Fortschritt +
  Download-Link. Ohne konfiguriertes Lambda meldet der Button klar, dass
  das AWS-Setup fehlt (siehe "Remotion Lambda einrichten" unten).

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
   - `ANTHROPIC_API_KEY`: optional, nur für die KI-Caption-Vorschläge im
     Konzept-Generator. Ohne Key funktioniert der Konzept-Generator trotzdem
     (Caption/Hashtags einfach manuell eintragen).
   - `REMOTION_LAMBDA_FUNCTION_NAME`, `REMOTION_SERVE_URL`, `AWS_REGION`,
     `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`: für die
     Rendering-Pipeline — siehe "Remotion Lambda einrichten" unten. Ohne
     diese Variablen funktioniert die App weiterhin, der "Video
     rendern"-Button meldet dann nur, dass Lambda noch nicht konfiguriert ist.

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

## Remotion lokal testen

Die Video-Komposition (`remotion/ShotlistVideo.tsx`) lässt sich unabhängig
vom Rest der App entwickeln und testen — kein AWS-Account nötig:

```bash
npm run remotion:studio   # interaktive Vorschau im Browser
npm run remotion:render   # rendert die Beispiel-Props aus remotion/Root.tsx nach out/video.mp4
```

Beim ersten Aufruf lädt Remotion einmalig einen eigenen Headless-Chromium
herunter. Beispiel-Props (`SAMPLE_PROPS` in `remotion/Root.tsx`) verwenden
öffentliche Test-Videos — für echte Clips per `--props` eine eigene JSON-Datei
mit `scenes`/`caption`/`hashtags` übergeben (siehe `ShotlistVideoProps` in
`remotion/ShotlistVideo.tsx`).

## Remotion Lambda einrichten

Das eigentliche Rendering läuft nicht auf Vercel (Zeitlimit), sondern auf
AWS Lambda über Remotion. Dieses Setup ist einmalig und muss manuell mit
einem eigenen AWS-Account gemacht werden — das kann Claude Code nicht für
dich übernehmen:

1. AWS-Account mit Zugriff auf IAM, Lambda und S3.
2. Benötigte IAM-Policy für den deployenden AWS-User ausgeben lassen und in
   der AWS-Console als Policy anlegen + dem User zuweisen:

   ```bash
   npx remotion lambda policies user
   ```

3. Benötigte IAM-Rolle für die Lambda-Ausführung ausgeben lassen und in der
   AWS-Console anlegen:

   ```bash
   npx remotion lambda policies role
   ```

4. AWS-Zugangsdaten des deployenden Users in `.env.local` eintragen:
   `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` (Standard
   `eu-central-1`).
5. Lambda-Funktion deployen:

   ```bash
   npx remotion lambda functions deploy
   ```

   Den ausgegebenen Funktionsnamen in `REMOTION_LAMBDA_FUNCTION_NAME`
   eintragen.

6. Projekt als "Site" auf S3 hochladen (Remotion bundelt dabei
   `remotion/index.ts`):

   ```bash
   npx remotion lambda sites create remotion/index.ts --site-name=ec-content-generator
   ```

   Die ausgegebene Serve-URL in `REMOTION_SERVE_URL` eintragen.

7. Dieselben fünf Variablen zusätzlich im Vercel-Dashboard hinterlegen.

Danach funktioniert der "Video rendern"-Button im Konzept-Generator: Er
erstellt einen `Render`-Datenbankeintrag, baut für jeden Clip eine
temporäre, signierte Proxy-URL (`/api/clips/[clipId]/media`, die serverseitig
mit dem Google-Zugriffstoken des Renders auf Drive zugreift und die
Videodaten durchreicht — Lambda selbst hat kein Google-Login) und startet
den Render auf Lambda. Fortschritt wird per Polling angezeigt, das fertige
Video landet in S3 und wird als Download-Link angezeigt.

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
