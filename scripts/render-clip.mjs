#!/usr/bin/env node
// Runs inside GitHub Actions (see .github/workflows/render.yml) — real
// system FFmpeg on a full-size runner, because Vercel's Hobby-plan CPU
// allocation is too weak to decode 4K/HEVC phone footage in reasonable
// time (see git history for the numbers: ~0.045x realtime on Vercel).
//
// Reads its job from environment variables (set by the workflow from the
// workflow_dispatch inputs) and reports the result back to the app via a
// callback webhook — there's no other channel back to the Next.js app
// from here.

import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { put } from "@vercel/blob";

const execFileAsync = promisify(execFile);

const RENDER_ID = requireEnv("RENDER_ID");
const DRIVE_ACCESS_TOKEN = requireEnv("DRIVE_ACCESS_TOKEN");
const SCENES_JSON = requireEnv("SCENES_JSON");
const CAPTION = process.env.CAPTION ?? "";
const APP_URL = requireEnv("APP_URL");
const RENDER_CALLBACK_SECRET = requireEnv("RENDER_CALLBACK_SECRET");

const FONT_PATH = path.join(process.cwd(), "assets/fonts/DejaVuSans-Bold.ttf");
const OUTPUT_WIDTH = 1080;
const OUTPUT_HEIGHT = 1920;
const FPS = 30;
const MIN_SCENE_SECONDS = 0.5;
const CAPTION_CHARS_PER_LINE = 26;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return value;
}

function driveMediaUrl(driveFileId) {
  return `https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`;
}

function wrapCaption(text, maxCharsPerLine) {
  const lines = [];
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

async function callback(body) {
  const res = await fetch(`${APP_URL}/api/render-callback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Render-Secret": RENDER_CALLBACK_SECRET,
    },
    body: JSON.stringify({ renderId: RENDER_ID, ...body }),
  });
  if (!res.ok) {
    console.error(`Callback failed: ${res.status} ${await res.text()}`);
  }
}

async function renderShotlist(scenes, caption) {
  const workDir = await mkdtemp(path.join(tmpdir(), "ec-render-"));

  try {
    const captionPath = path.join(workDir, "caption.txt");
    await writeFile(captionPath, wrapCaption(caption, CAPTION_CHARS_PER_LINE), "utf-8");

    const outputPath = path.join(workDir, "output.mp4");

    const args = ["-y"];
    for (const scene of scenes) {
      args.push(
        "-headers",
        `Authorization: Bearer ${DRIVE_ACCESS_TOKEN}\r\n`,
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
      "fast",
      "-crf",
      "23",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      outputPath
    );

    await execFileAsync("ffmpeg", args, { maxBuffer: 1024 * 1024 * 64 });

    return await readFile(outputPath);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

async function main() {
  const scenes = JSON.parse(SCENES_JSON);

  const videoBuffer = await renderShotlist(scenes, CAPTION);

  const blob = await put(`renders/${RENDER_ID}.mp4`, videoBuffer, {
    access: "public",
    contentType: "video/mp4",
  });

  await callback({ status: "done", outputUrl: blob.url });
  console.log("Render done:", blob.url);
}

main().catch(async (error) => {
  const detail = error instanceof Error ? error.message : String(error);
  console.error("Render failed:", detail);
  await callback({ status: "error", errorMessage: detail.slice(0, 2000) });
  process.exit(1);
});
