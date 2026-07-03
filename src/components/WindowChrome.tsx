import { IS_LINUX, IS_MAC } from '@/lib/platform';

/**
 * Platform-native window chrome.
 *
 * - macOS: the OS draws the title bar; the webview paints under it
 *   (when titleBarStyle:Overlay is set in tauri.conf.json). We render
 *   an empty spacer so content starts at the right offset.
 * - Linux: Adwaita uses Client-Side Decorations. We render a custom
 *   header bar with the window title and the window controls (close,
 *   minimize, maximize) drawn by the OS / libadwaita WindowHandle.
 * - Windows: no extra chrome.
 *
 * The actual macOS titlebarStyle / Linux hiddenTitle setting is
 * applied in tauri.conf.json (windows[label=main].titleBarStyle and
 * .hiddenTitle per platform).
 */
export function WindowChrome() {
  if (IS_MAC) {
    return <div className="mac-titlebar-overlay" aria-hidden />;
  }
  if (IS_LINUX) {
    return (
      <header className="linux-csd-header" data-tauri-drag-region>
        <span className="csd-title">SmoothScroll</span>
        <div className="csd-actions" data-tauri-drag-region={false}>
          {/* Window controls (minimize / maximize / close) are drawn by
           * libadwaita via WindowHandle when decorations=true. Web content
           * here stays clear of the right-side reserved zone. */}
        </div>
      </header>
    );
  }
  return null;
}