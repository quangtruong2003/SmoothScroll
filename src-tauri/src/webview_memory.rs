use tauri::{Runtime, WebviewWindow};

#[cfg(windows)]
fn memory_target(
    backgrounded: bool,
) -> webview2_com::Microsoft::Web::WebView2::Win32::COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL {
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW, COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL,
    };

    if backgrounded {
        COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW
    } else {
        COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL
    }
}

pub(crate) fn set_backgrounded<R: Runtime>(window: &WebviewWindow<R>, backgrounded: bool) {
    #[cfg(windows)]
    {
        let label = window.label().to_owned();
        let log_label = label.clone();
        let result = window.with_webview(move |webview| {
            use webview2_com::Microsoft::Web::WebView2::Win32::{
                ICoreWebView2_19,
            };
            use windows_core::Interface;

            let controller = webview.controller();
            // SAFETY: Tauri runs this callback synchronously on its main-thread event loop,
            // and `controller` plus the derived CoreWebView2 interfaces remain valid for it.
            unsafe {
                if let Err(error) = controller.SetIsVisible(!backgrounded) {
                    tracing::debug!(%error, window = %log_label, "failed to sync WebView2 visibility");
                }

                let core = match controller.CoreWebView2() {
                    Ok(core) => core,
                    Err(error) => {
                        tracing::debug!(%error, window = %log_label, "failed to get WebView2 core");
                        return;
                    }
                };
                let core = match core.cast::<ICoreWebView2_19>() {
                    Ok(core) => core,
                    Err(error) => {
                        tracing::debug!(%error, window = %log_label, "WebView2 memory target API unavailable");
                        return;
                    }
                };
                if let Err(error) = core.SetMemoryUsageTargetLevel(memory_target(backgrounded)) {
                    tracing::debug!(%error, window = %log_label, "failed to set WebView2 memory target");
                }
            }
        });
        if let Err(error) = result {
            tracing::debug!(%error, window = %label, "failed to access native WebView2");
        }
    }

    #[cfg(not(windows))]
    let _ = (window, backgrounded);
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW, COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL,
    };

    #[test]
    fn background_state_selects_expected_memory_target() {
        assert_eq!(
            memory_target(true),
            COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW
        );
        assert_eq!(
            memory_target(false),
            COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL
        );
    }
}
