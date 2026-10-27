// The desktop widget can update itself: it asks GitHub for the newest release,
// and when there is one the panel offers it. Everything here is desktop-only;
// in a browser the app is whatever the server sent, so there is nothing to
// check and the panel shows no banner.

import type { Update } from "@tauri-apps/plugin-updater";
import { isDesktop } from "./desktop";

/** How long after launch to look, so the first paint is never delayed. */
const FIRST_CHECK_MS = 3_000;
/** And how often after that, for a widget left running for days. */
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;

export type InstallPhase = "downloading" | "installing";

export interface AvailableUpdate {
  /** The release's version, e.g. "1.0.1". */
  version: string;
  /** The release notes, when the release has them. */
  notes: string;
  /** Download, install, and relaunch into the new build. */
  install: (onPhase: (phase: InstallPhase) => void) => Promise<void>;
}

/** Ask the configured endpoint (the latest GitHub release) for a newer build. */
async function findUpdate(): Promise<AvailableUpdate | null> {
  if (!isDesktop) return null;
  let update: Update | null = null;
  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    update = await check();
    if (!update) return null;
  } catch {
    // No network, GitHub down, or a release with no updater files: a clock
    // that cannot check for updates is still a clock.
    return null;
  }

  return {
    version: update.version,
    notes: update.body ?? "",
    install: async (onPhase) => {
      onPhase("downloading");
      await update.download();
      onPhase("installing");
      // On Windows this hands the app to the installer and exits; on macOS the
      // new bundle is in place and the relaunch below starts it.
      await update.install();
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    },
  };
}

/**
 * Look for a newer release shortly after launch, then every few hours.
 *
 * A check is one small JSON file; it never blocks the clock. Returns a
 * function that stops the watch when the panel goes away.
 */
export function watchForUpdates(onFound: (update: AvailableUpdate) => void): () => void {
  if (!isDesktop) return () => {};
  let stopped = false;
  let timer = 0;

  const run = async () => {
    const found = await findUpdate();
    if (stopped) return;
    if (found) onFound(found);
    timer = window.setTimeout(run, CHECK_EVERY_MS);
  };

  timer = window.setTimeout(run, FIRST_CHECK_MS);
  return () => {
    stopped = true;
    window.clearTimeout(timer);
  };
}
