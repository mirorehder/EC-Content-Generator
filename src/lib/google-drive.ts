import { google } from "googleapis";

const FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";

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
  /** Name of the immediate subfolder the video was found in, or null if found in the root folder itself. */
  category: string | null;
}

/**
 * Recursively walks the given folder (BFS) and returns every video file found
 * at any depth. `category` on each result is the name of the direct parent
 * subfolder, since raw-footage libraries are commonly organized that way
 * (e.g. "Parkour-Bangers", "Trainings-Clips") and that grouping is useful
 * signal for later clip matching.
 */
export async function listVideoFiles(
  accessToken: string,
  rootFolderId: string
): Promise<DriveVideoFile[]> {
  const drive = createDriveClient(accessToken);
  const files: DriveVideoFile[] = [];
  const visited = new Set<string>();
  const queue: { id: string; category: string | null }[] = [
    { id: rootFolderId, category: null },
  ];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current.id)) continue;
    visited.add(current.id);

    let pageToken: string | undefined;

    do {
      const res = await drive.files.list({
        q: `'${current.id}' in parents and trashed = false`,
        fields:
          "nextPageToken, files(id, name, mimeType, thumbnailLink, webViewLink, videoMediaMetadata(durationMillis))",
        pageSize: 100,
        pageToken,
      });

      for (const file of res.data.files ?? []) {
        if (!file.id || !file.name || !file.mimeType) continue;

        if (file.mimeType === FOLDER_MIME_TYPE) {
          queue.push({ id: file.id, category: file.name });
          continue;
        }

        if (!file.mimeType.includes("video/")) continue;

        files.push({
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          durationMs: file.videoMediaMetadata?.durationMillis
            ? Number(file.videoMediaMetadata.durationMillis)
            : null,
          thumbnailLink: file.thumbnailLink ?? null,
          webViewLink: file.webViewLink ?? null,
          category: current.category,
        });
      }

      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);
  }

  return files;
}

export interface DriveMediaStream {
  stream: NodeJS.ReadableStream;
  mimeType: string;
  contentLength: string | null;
}

export async function getDriveMediaStream(
  accessToken: string,
  driveFileId: string
): Promise<DriveMediaStream> {
  const drive = createDriveClient(accessToken);
  const res = await drive.files.get(
    { fileId: driveFileId, alt: "media" },
    { responseType: "stream" }
  );

  return {
    stream: res.data,
    mimeType: (res.headers["content-type"] as string | undefined) ?? "video/mp4",
    contentLength: (res.headers["content-length"] as string | undefined) ?? null,
  };
}
