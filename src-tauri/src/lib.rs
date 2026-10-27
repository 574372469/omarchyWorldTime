// The desktop widget is the same panel, in a small always-on-top window.
// Everything the panel needs is static, so the shell only has to draw it and
// hand links to the machine's browser.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            // Windows only: a widget should not take an Alt-Tab slot from the
            // apps behind it, but it stays on the taskbar so it can be found.
            #[cfg(target_os = "windows")]
            {
                use tauri::Manager;
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_always_on_top(true);
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running the world clock");
}
