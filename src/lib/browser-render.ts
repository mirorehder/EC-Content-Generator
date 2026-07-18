// Schneidet die Shotlist komplett im Browser zusammen: Jeder Clip wird in
// einem unsichtbaren <video> abgespielt (nutzt den Hardware-Decoder des
// Geräts — genau das, woran serverseitiges Rendern auf Vercel scheiterte),
// auf ein 1080x1920-Canvas gezeichnet (Cover-Crop + Caption-Overlay) und
// der Canvas-Stream per MediaRecorder aufgezeichnet. Die Aufnahme läuft
// dadurch in Echtzeit: ein 16s-Video braucht ~16s.

export interface BrowserRenderScene {
  /** Object-URL (oder normale URL) der Videodatei. */
  url: string;
  timingSeconds: number;
}

export interface BrowserRenderOptions {
  scenes: BrowserRenderScene[];
  caption: string;
  onProgress?: (fraction: number) => void;
}

export interface BrowserRenderResult {
  blob: Blob;
  mimeType: string;
  extension: "mp4" | "webm";
}

const WIDTH = 1080;
const HEIGHT = 1920;
const FPS = 30;
const MIN_SCENE_SECONDS = 0.5;
const CAPTION_CHARS_PER_LINE = 26;
const FONT_SIZE = 54;
const LINE_SPACING = 8;
const BOX_PADDING = 24;
const BOTTOM_MARGIN = 140;

// Safari (inkl. iPhone) und aktuelles Chrome können direkt MP4 aufnehmen;
// ältere Browser fallen auf WebM zurück.
const MIME_CANDIDATES: { mimeType: string; extension: "mp4" | "webm" }[] = [
  { mimeType: "video/mp4", extension: "mp4" },
  { mimeType: "video/webm;codecs=vp9,opus", extension: "webm" },
  { mimeType: "video/webm", extension: "webm" },
];

function pickMimeType() {
  const found = MIME_CANDIDATES.find((c) => MediaRecorder.isTypeSupported(c.mimeType));
  if (!found) throw new Error("Dieser Browser unterstützt keine Video-Aufnahme (MediaRecorder).");
  return found;
}

function wrapCaption(text: string, maxCharsPerLine: number): string[] {
  const lines: string[] = [];
  let currentLine = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (candidate.length > maxCharsPerLine && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = candidate;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

function drawCoverFrame(ctx: CanvasRenderingContext2D, video: HTMLVideoElement) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return;

  const scale = Math.max(WIDTH / vw, HEIGHT / vh);
  const dw = vw * scale;
  const dh = vh * scale;
  ctx.drawImage(video, (WIDTH - dw) / 2, (HEIGHT - dh) / 2, dw, dh);
}

function drawCaption(ctx: CanvasRenderingContext2D, lines: string[]) {
  if (lines.length === 0) return;

  ctx.font = `bold ${FONT_SIZE}px system-ui, -apple-system, sans-serif`;
  ctx.textBaseline = "top";

  const lineHeight = FONT_SIZE + LINE_SPACING;
  const textHeight = lines.length * lineHeight - LINE_SPACING;
  const textWidth = Math.max(...lines.map((line) => ctx.measureText(line).width));

  const boxWidth = textWidth + BOX_PADDING * 2;
  const boxHeight = textHeight + BOX_PADDING * 2;
  const boxX = (WIDTH - boxWidth) / 2;
  const boxY = HEIGHT - BOTTOM_MARGIN - boxHeight;

  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

  ctx.fillStyle = "#ffffff";
  lines.forEach((line, i) => {
    const lineWidth = ctx.measureText(line).width;
    ctx.fillText(line, (WIDTH - lineWidth) / 2, boxY + BOX_PADDING + i * lineHeight);
  });
}

function loadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "auto";
    video.playsInline = true;
    video.crossOrigin = "anonymous";
    video.src = url;
    video.addEventListener("loadedmetadata", () => resolve(video), { once: true });
    video.addEventListener(
      "error",
      () => reject(new Error("Ein Clip konnte nicht geladen/dekodiert werden.")),
      { once: true }
    );
  });
}

async function playScene(
  video: HTMLVideoElement,
  seconds: number,
  ctx: CanvasRenderingContext2D,
  captionLines: string[],
  onFrame: (sceneElapsed: number) => void
): Promise<void> {
  try {
    await video.play();
  } catch {
    // Autoplay-Beschränkung (v.a. mobile Browser): stumm erneut versuchen.
    // Kostet die Tonspur dieses Clips, aber der Render läuft durch.
    video.muted = true;
    await video.play();
  }

  await new Promise<void>((resolve, reject) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      video.pause();
      resolve();
    };

    video.addEventListener("ended", finish, { once: true });
    video.addEventListener("error", () => reject(new Error("Clip-Wiedergabe fehlgeschlagen.")), {
      once: true,
    });

    const tick = () => {
      if (done) return;
      drawCoverFrame(ctx, video);
      drawCaption(ctx, captionLines);
      onFrame(Math.min(video.currentTime, seconds));
      if (video.currentTime >= seconds) {
        finish();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

export async function renderShotlistInBrowser(
  options: BrowserRenderOptions
): Promise<BrowserRenderResult> {
  const { scenes, caption, onProgress } = options;
  if (scenes.length === 0) {
    throw new Error("Keine Szenen zum Rendern vorhanden.");
  }

  const { mimeType, extension } = pickMimeType();
  const captionLines = wrapCaption(caption, CAPTION_CHARS_PER_LINE);

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas wird nicht unterstützt.");

  const videos = await Promise.all(scenes.map((scene) => loadVideo(scene.url)));

  // Tonspuren der Clips über WebAudio in einen durchgehenden Audio-Track
  // mischen (createMediaElementSource koppelt die Elemente vom Lautsprecher
  // ab — beim Rendern ist nichts zu hören).
  const audioCtx = new AudioContext();
  const audioDest = audioCtx.createMediaStreamDestination();
  for (const video of videos) {
    audioCtx.createMediaElementSource(video).connect(audioDest);
  }

  const canvasStream = canvas.captureStream(FPS);
  const recordStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...audioDest.stream.getAudioTracks(),
  ]);

  const recorder = new MediaRecorder(recordStream, {
    mimeType,
    videoBitsPerSecond: 8_000_000,
  });
  const chunks: Blob[] = [];
  recorder.addEventListener("dataavailable", (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  });

  const recordingDone = new Promise<void>((resolve, reject) => {
    recorder.addEventListener("stop", () => resolve(), { once: true });
    recorder.addEventListener(
      "error",
      () => reject(new Error("Aufnahme fehlgeschlagen (MediaRecorder).")),
      { once: true }
    );
  });

  const sceneDurations = scenes.map((scene) => Math.max(scene.timingSeconds, MIN_SCENE_SECONDS));
  const totalSeconds = sceneDurations.reduce((sum, s) => sum + s, 0);

  try {
    if (audioCtx.state === "suspended") await audioCtx.resume();
    recorder.start(1000);

    let elapsedBefore = 0;
    for (const [i, video] of videos.entries()) {
      await playScene(video, sceneDurations[i], ctx, captionLines, (sceneElapsed) => {
        onProgress?.((elapsedBefore + sceneElapsed) / totalSeconds);
      });
      elapsedBefore += sceneDurations[i];
    }
  } finally {
    recorder.stop();
    await recordingDone.catch(() => {});
    await audioCtx.close().catch(() => {});
    for (const video of videos) {
      video.src = "";
    }
  }

  onProgress?.(1);
  return { blob: new Blob(chunks, { type: mimeType }), mimeType, extension };
}
