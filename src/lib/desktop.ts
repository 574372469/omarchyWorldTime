// The panel is one codebase in two places: a page, and a desktop widget
// inside Tauri. Only the few things a browser cannot do — dragging a window
// with no title bar, opening a link outside it, closing it — go through here.

import { isTauri } from "@tauri-apps/api/core";

/** True when the panel runs as the desktop widget rather than in a browser. */
export const isDesktop = isTauri();

/** Move the widget's window as the pointer drags a part of the panel. */
export async function dragWindow(): Promise<void> {
  if (!isDesktop) return;
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().startDragging();
  } catch {
    /* a window that cannot be dragged is still a working clock */
  }
}

/** Open a link in the machine's browser rather than inside the widget. */
export async function openExternal(url: string): Promise<void> {
  if (!isDesktop) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  try {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
  } catch {
    /* nothing else can open it; the link stays where it was */
  }
}

/** Close the widget. */
export async function closeWindow(): Promise<void> {
  if (!isDesktop) return;
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().close();
  } catch {
    /* the window is already gone */
  }
}
