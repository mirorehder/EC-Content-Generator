import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Remotions Node-Pakete (Webpack-Bundler, nativer Compositor) lassen
  // sich nicht statisch in den Server-Build bundeln.
  serverExternalPackages: ["@remotion/bundler", "@remotion/renderer"],
};

export default nextConfig;
