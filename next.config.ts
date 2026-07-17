import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @ffmpeg-installer/ffmpeg löst seinen Binary-Pfad zur Laufzeit über
  // dynamische requires auf — das lässt sich nicht statisch bundeln.
  serverExternalPackages: ["@ffmpeg-installer/ffmpeg"],
  // Der Font fürs Caption-Overlay wird nur per Dateipfad (nicht per import)
  // von ffmpeg gelesen — ohne diesen Hinweis würde Next ihn beim Tracing
  // fürs Vercel-Deployment nicht automatisch mit einpacken.
  outputFileTracingIncludes: {
    "/*": ["assets/fonts/**/*"],
  },
};

export default nextConfig;
