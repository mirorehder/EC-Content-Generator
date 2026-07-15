# EdgeChase Content Generator

Next.js-App, die (1) Trend-/Hook-Konzepte aufbereitet, (2) Videos aus einem
Google-Drive-Ordner liest und (3) daraus eine Schnitt-/Rendering-Pipeline
anstößt. Siehe der ursprünglichen Architektur-Spezifikation für den vollen
Umfang.

## Status

Aktuell umgesetzt (Schritt 1 der empfohlenen Reihenfolge):

- Next.js App Router Projekt (TypeScript, Tailwind v4)
- Google-Login via NextAuth (Auth.js v5) mit `drive.readonly`-Scope inkl.
  Refresh-Token-Handling
- Geschützte `/dashboard`-Route als Platzhalter für die weiteren Module
- shadcn/ui-Grundkomponenten (`Button`, `Card`)

Noch offen: Drive-Sync, Trend-/Hook-Board, Konzept-Generator, Remotion-Pipeline.

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
   - `DATABASE_URL`, `REMOTION_LAMBDA_FUNCTION_NAME`, `AWS_ACCESS_KEY_ID`,
     `AWS_SECRET_ACCESS_KEY`: werden erst für spätere Module benötigt.

3. Dev-Server starten:

   ```bash
   npm run dev
   ```

   [http://localhost:3000](http://localhost:3000) öffnen. Login leitet nach
   `/dashboard` weiter.

## Deployment

Auf Vercel deployen und dieselben Variablen aus `.env.example` im
Vercel-Dashboard (Project Settings → Environment Variables) hinterlegen.
Secrets niemals im Code oder Chat teilen.

## Weitere Befehle

```bash
npm run build   # Produktions-Build
npm run lint    # ESLint
```
