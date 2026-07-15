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

Noch offen: Remotion-Rendering-Pipeline.

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
   - `REMOTION_LAMBDA_FUNCTION_NAME`, `AWS_ACCESS_KEY_ID`,
     `AWS_SECRET_ACCESS_KEY`: werden erst für die Remotion-Rendering-Pipeline
     benötigt.

3. Datenbank-Schema anwenden:

   ```bash
   npx prisma migrate dev
   ```

4. Dev-Server starten:

   ```bash
   npm run dev
   ```

   [http://localhost:3000](http://localhost:3000) öffnen. Login leitet nach
   `/dashboard` weiter. Dort lässt sich über die Ordner-ID + "Jetzt
   synchronisieren" der Drive-Sync manuell auslösen.

## Deployment

Auf Vercel deployen und dieselben Variablen aus `.env.example` im
Vercel-Dashboard (Project Settings → Environment Variables) hinterlegen.
Secrets niemals im Code oder Chat teilen.

Der Prisma Client wird bei jedem `npm install` automatisch neu generiert
(`postinstall`-Script). Für Migrationen auf der Produktions-DB:
`npx prisma migrate deploy`.

## Weitere Befehle

```bash
npm run build   # Produktions-Build
npm run lint    # ESLint
```
