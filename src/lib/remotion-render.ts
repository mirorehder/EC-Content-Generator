import path from "node:path";

import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

import type { ShotlistVideoProps } from "../../remotion/ShotlistVideo";

const COMPOSITION_ID = "ShotlistVideo";

// Das Webpack-Bundle der Komposition ist pro Prozess wiederverwendbar —
// globalThis statt Modul-Scope, weil Next dev Server Actions und Routen
// getrennt bundelt (Modul-State wäre dupliziert, der Prozess ist derselbe).
const globalCache = globalThis as unknown as { __remotionBundle?: Promise<string> };

function getBundle(): Promise<string> {
  globalCache.__remotionBundle ??= bundle({
    entryPoint: path.join(process.cwd(), "remotion/index.ts"),
  });
  return globalCache.__remotionBundle;
}

/**
 * Rendert die Shotlist lokal über die Remotion-Node-API (Headless-Chrome
 * wird beim allerersten Render einmalig heruntergeladen). Nur für den
 * lokalen Betrieb gedacht — auf Vercel fehlt dafür die CPU.
 */
export async function renderShotlistVideo(
  inputProps: ShotlistVideoProps,
  outputLocation: string
): Promise<void> {
  const serveUrl = await getBundle();

  // Optionaler Override, z.B. für Umgebungen ohne Download-Zugriff auf
  // Remotions eigenen Headless-Shell (Tests). Ein extern vorgegebenes
  // Chrome ist ein Vollbrowser und braucht den "chrome-for-testing"-Modus.
  const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE || null;
  const chromeMode = browserExecutable ? ("chrome-for-testing" as const) : ("headless-shell" as const);

  const composition = await selectComposition({
    serveUrl,
    id: COMPOSITION_ID,
    inputProps,
    browserExecutable,
    chromeMode,
  });

  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation,
    inputProps,
    browserExecutable,
    chromeMode,
  });
}
