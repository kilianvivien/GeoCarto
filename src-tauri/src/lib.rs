// The desktop shell is intentionally thin: the .cartoproj document is the source
// of truth and all rendering/export happens in the web frontend. The Rust side
// only wires up native file dialogs and filesystem access so save/open/export
// can reach the real disk under WKWebView (which lacks the File System Access API).
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .run(tauri::generate_context!())
        .expect("error while running GeoCarto");
}
