import { Composition } from "remotion";

import { ShotlistVideo, calculateShotlistVideoMetadata, shotlistVideoSchema } from "./ShotlistVideo";

const SAMPLE_PROPS = {
  scenes: [
    {
      order: 1,
      clipUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
      note: "Hook-Overlay über erste Szene",
      timingSeconds: 4,
    },
    {
      order: 2,
      clipUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
      note: "Wendepunkt mit Produkt",
      timingSeconds: 4,
    },
  ],
  caption: "So sieht ein EdgeChase-Konzept in Bewegung aus.",
  hashtags: ["#edgechase", "#streetwear"],
};

export function RemotionRoot() {
  return (
    <Composition
      id="ShotlistVideo"
      component={ShotlistVideo}
      schema={shotlistVideoSchema}
      defaultProps={SAMPLE_PROPS}
      calculateMetadata={calculateShotlistVideoMetadata}
    />
  );
}
