import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export type UpdateCheckResult =
  | { state: "up-to-date"; currentVersion: string }
  | { state: "available"; update: Update; currentVersion: string; newVersion: string }
  | { state: "error"; message: string };

export async function checkForUpdate(): Promise<UpdateCheckResult> {
  try {
    const update = await check();
    if (!update) {
      return { state: "up-to-date", currentVersion: "" };
    }
    return {
      state: "available",
      update,
      currentVersion: update.currentVersion,
      newVersion: update.version,
    };
  } catch (e) {
    return { state: "error", message: String(e) };
  }
}

export interface InstallProgress {
  downloaded: number;
  total: number | null;
  done: boolean;
}

export async function downloadAndInstall(
  update: Update,
  onProgress: (p: InstallProgress) => void,
): Promise<void> {
  let total: number | null = null;
  let downloaded = 0;
  await update.downloadAndInstall((event) => {
    switch (event.event) {
      case "Started":
        total = event.data.contentLength ?? null;
        onProgress({ downloaded: 0, total, done: false });
        break;
      case "Progress":
        downloaded += event.data.chunkLength;
        onProgress({ downloaded, total, done: false });
        break;
      case "Finished":
        onProgress({ downloaded, total, done: true });
        break;
    }
  });
}

export async function restartApp(): Promise<void> {
  await relaunch();
}
