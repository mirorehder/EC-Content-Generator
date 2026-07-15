import { google } from "googleapis";

export function createDriveClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.drive({ version: "v3", auth });
}

export interface DriveVideoFile {
  id: string;
  name: string;
  mimeType: string;
  durationMs: number | null;
  thumbnailLink: string | null;
  webViewLink: string | null;
}

export async function listVideoFiles(
  accessToken: string,
  folderId: string
): Promise<DriveVideoFile[]> {
  const drive = createDriveClient(accessToken);
  const files: DriveVideoFile[] = [];
  let pageToken: string | undefined;

  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and mimeType contains 'video/' and trashed = false`,
      fields:
        "nextPageToken, files(id, name, mimeType, thumbnailLink, webViewLink, videoMediaMetadata(durationMillis))",
      pageSize: 100,
      pageToken,
    });

    for (const file of res.data.files ?? []) {
      if (!file.id || !file.name || !file.mimeType) continue;
      files.push({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        durationMs: file.videoMediaMetadata?.durationMillis
          ? Number(file.videoMediaMetadata.durationMillis)
          : null,
        thumbnailLink: file.thumbnailLink ?? null,
        webViewLink: file.webViewLink ?? null,
      });
    }

    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return files;
}
