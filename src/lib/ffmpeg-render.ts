import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import ffmpeg from "@ffmpeg-installer/ffmpeg";

const execFileAsync = promisify(execFile);

function driveMediaUrl(driveFileId: string): string {
  return `https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`;
}

const FONT_PATH = path.join(process.cwd(), "assets/fonts/DejaVuSans-Bold.ttf");
const OUTPUT_WIDTH = 1080;
const OUTPUT_HEIGHT = 1920;
const FPS = 30;
const MIN_SCENE_SECONDS = 0.5;
const CAPTION_CHARS_PER_LINE = 26;

function wrapCaption(text: string, maxCharsPerLine: number): string {
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

  return lines.join("\n");
}

export interface RenderScene {
  driveFileId: string;
  timingSeconds: number;
}

/**
 * Concatenates the given clips (trimmed to each scene's timing) into one
 * vertical (1080x1920) video and burns the caption in as a text overlay.
 *
 * Clips are streamed straight from Drive into ffmpeg (via `-headers` +
 * an authenticated URL) instead of being downloaded to disk first —
 * source footage can be several minutes of 4K per file, which blew past
 * Vercel's ~512MB /tmp budget when we wrote whole clips to disk just to
 * use a few trimmed seconds of each. Only the small rendered output is
 * ever written to disk now.
 *
 * Assumes every clip has an audio stream — raw camera/phone footage does
 * in practice, but a silent source clip will make ffmpeg fail with a
 * clear "Stream specifier ':a' ... matches no streams" error.
 */
export async function renderShotlist(
  accessToken: string,
  scenes: RenderScene[],
  caption: string
): Promise<Buffer> {
  if (scenes.length === 0) {
    throw new Error("Keine Szenen zum Rendern vorhanden.");
  }

  const workDir = await mkdtemp(path.join(tmpdir(), "ec-render-"));

  try {
    const captionPath = path.join(workDir, "caption.txt");
    await writeFile(captionPath, wrapCaption(caption, CAPTION_CHARS_PER_LINE), "utf-8");

    const outputPath = path.join(workDir, "output.mp4");

    const args: string[] = ["-y"];
    for (const scene of scenes) {
      args.push(
        "-headers",
        `Authorization: Bearer ${accessToken}\r\n`,
        "-t",
        String(Math.max(scene.timingSeconds, MIN_SCENE_SECONDS)),
        "-i",
        driveMediaUrl(scene.driveFileId)
      );
    }

    const perClipFilters = scenes
      .map(
        (_, i) =>
          `[${i}:v]scale=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT}:force_original_aspect_ratio=increase,` +
          `crop=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT},setsar=1,fps=${FPS}[v${i}];` +
          `[${i}:a]aresample=44100,aformat=channel_layouts=stereo[a${i}]`
      )
      .join(";");

    const concatInputs = scenes.map((_, i) => `[v${i}][a${i}]`).join("");

    const filterComplex =
      `${perClipFilters};` +
      `${concatInputs}concat=n=${scenes.length}:v=1:a=1[vconcat][aout];` +
      `[vconcat]drawtext=fontfile='${FONT_PATH}':textfile='${captionPath}':` +
      `fontcolor=white:fontsize=54:box=1:boxcolor=black@0.55:boxborderw=24:` +
      `x=(w-text_w)/2:y=h-text_h-140:line_spacing=8[vout]`;

    args.push(
      "-filter_complex",
      filterComplex,
      "-map",
      "[vout]",
      "-map",
      "[aout]",
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-crf",
      "26",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      outputPath
    );

    try {
      await execFileAsync(ffmpeg.path, args, {
        maxBuffer: 1024 * 1024 * 64,
        // Fail with a clear error before Vercel's own function timeout would
        // kill the whole invocation without one.
        timeout: 270_000,
      });
    } catch (error) {
      if (error && typeof error === "object" && "killed" in error && error.killed) {
        throw new Error("FFmpeg-Timeout — das Rendern hat zu lange gedauert.");
      }
      throw error;
    }

    return await readFile(outputPath);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
