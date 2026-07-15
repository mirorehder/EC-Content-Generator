import { getRenderProgress, renderMediaOnLambda, type AwsRegion } from "@remotion/lambda/client";

import type { ShotlistVideoProps } from "../../remotion/ShotlistVideo";

const COMPOSITION_ID = "ShotlistVideo";

function getRegion(): AwsRegion {
  return (process.env.AWS_REGION as AwsRegion | undefined) ?? "eu-central-1";
}

export function isLambdaConfigured(): boolean {
  return Boolean(
    process.env.REMOTION_LAMBDA_FUNCTION_NAME &&
      process.env.REMOTION_SERVE_URL &&
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY
  );
}

export async function triggerLambdaRender(inputProps: ShotlistVideoProps) {
  if (!isLambdaConfigured()) {
    throw new Error(
      "Remotion Lambda ist nicht konfiguriert (REMOTION_LAMBDA_FUNCTION_NAME / REMOTION_SERVE_URL / AWS-Zugangsdaten fehlen)."
    );
  }

  return renderMediaOnLambda({
    region: getRegion(),
    functionName: process.env.REMOTION_LAMBDA_FUNCTION_NAME!,
    serveUrl: process.env.REMOTION_SERVE_URL!,
    composition: COMPOSITION_ID,
    inputProps,
    codec: "h264",
    privacy: "public",
  });
}

export async function checkLambdaRenderProgress(renderId: string, bucketName: string) {
  if (!isLambdaConfigured()) {
    throw new Error("Remotion Lambda ist nicht konfiguriert.");
  }

  return getRenderProgress({
    renderId,
    bucketName,
    functionName: process.env.REMOTION_LAMBDA_FUNCTION_NAME!,
    region: getRegion(),
  });
}
