import {
  AbsoluteFill,
  OffthreadVideo,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";

export const FPS = 30;
const CROSSFADE_FRAMES = 15;

export const shotlistSceneSchema = z.object({
  order: z.number(),
  clipUrl: z.string(),
  note: z.string(),
  timingSeconds: z.number().positive(),
});

export const shotlistVideoSchema = z.object({
  scenes: z.array(shotlistSceneSchema).min(1),
  caption: z.string(),
  hashtags: z.array(z.string()),
});

export type ShotlistVideoProps = z.infer<typeof shotlistVideoSchema>;

export function calculateShotlistVideoMetadata({ props }: { props: ShotlistVideoProps }) {
  const totalSeconds = props.scenes.reduce((sum, scene) => sum + scene.timingSeconds, 0);
  return {
    durationInFrames: Math.max(1, Math.round(totalSeconds * FPS)),
    fps: FPS,
    width: 1080,
    height: 1920,
  };
}

function SceneClip({
  clipUrl,
  note,
  durationInFrames,
  isFirst,
  isLast,
}: {
  clipUrl: string;
  note: string;
  durationInFrames: number;
  isFirst: boolean;
  isLast: boolean;
}) {
  const frame = useCurrentFrame();

  const fadeIn = isFirst
    ? 1
    : interpolate(frame, [0, CROSSFADE_FRAMES], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = isLast
    ? 1
    : interpolate(
        frame,
        [durationInFrames - CROSSFADE_FRAMES, durationInFrames],
        [1, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
      );
  const opacity = Math.min(fadeIn, fadeOut);

  return (
    <AbsoluteFill style={{ opacity }}>
      <OffthreadVideo src={clipUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      <AbsoluteFill
        style={{
          justifyContent: "flex-end",
          padding: 48,
        }}
      >
        <div
          style={{
            color: "white",
            fontFamily: "Arial, sans-serif",
            fontSize: 36,
            fontWeight: 700,
            textShadow: "0 2px 8px rgba(0,0,0,0.8)",
          }}
        >
          {note}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

function CaptionOverlay({ caption, hashtags }: { caption: string; hashtags: string[] }) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", padding: 48, opacity }}>
      <div
        style={{
          color: "white",
          fontFamily: "Arial, sans-serif",
          fontSize: 32,
          fontWeight: 600,
          textShadow: "0 2px 8px rgba(0,0,0,0.8)",
          marginBottom: 16,
        }}
      >
        {caption}
      </div>
      <div
        style={{
          color: "#7dd3fc",
          fontFamily: "Arial, sans-serif",
          fontSize: 24,
          textShadow: "0 2px 8px rgba(0,0,0,0.8)",
        }}
      >
        {hashtags.join(" ")}
      </div>
    </AbsoluteFill>
  );
}

export function ShotlistVideo({ scenes, caption, hashtags }: ShotlistVideoProps) {
  const { fps } = useVideoConfig();
  const sorted = [...scenes].sort((a, b) => a.order - b.order);

  const placedScenes = sorted.reduce<
    { scene: (typeof sorted)[number]; startFrame: number; durationInFrames: number; index: number }[]
  >((acc, scene, index) => {
    const previous = acc[index - 1];
    const startFrame = previous ? previous.startFrame + previous.durationInFrames : 0;
    const durationInFrames = Math.max(1, Math.round(scene.timingSeconds * fps));
    acc.push({ scene, startFrame, durationInFrames, index });
    return acc;
  }, []);

  const totalFrames = placedScenes.reduce(
    (sum, { durationInFrames }) => sum + durationInFrames,
    0
  );
  const captionStartFrame = Math.max(0, totalFrames - Math.round(2 * fps));

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {placedScenes.map(({ scene, startFrame: sceneStart, durationInFrames, index }) => (
        <Sequence key={scene.order} from={sceneStart} durationInFrames={durationInFrames}>
          <SceneClip
            clipUrl={scene.clipUrl}
            note={scene.note}
            durationInFrames={durationInFrames}
            isFirst={index === 0}
            isLast={index === placedScenes.length - 1}
          />
        </Sequence>
      ))}
      <Sequence from={captionStartFrame}>
        <CaptionOverlay caption={caption} hashtags={hashtags} />
      </Sequence>
    </AbsoluteFill>
  );
}
