// The desktop shell is intentionally thin: the .cartoproj document is the source
// of truth and all rendering/export happens in the web frontend. The Rust side
// wires up native file dialogs, filesystem access, and the macOS menu bar. Menu
// selections are emitted into the webview so React still owns document behavior.
use tauri::{
    menu::{
        AboutMetadata, Menu, MenuBuilder, MenuItem, MenuItemKind, PredefinedMenuItem,
        SubmenuBuilder,
    },
    AppHandle, Emitter, Runtime,
};

const APP_COMMAND_IDS: &[&str] = &[
    "new-project",
    "open-project",
    "import-data",
    "save-project",
    "save-project-as",
    "export",
    "share-png",
    "close-tab",
    "undo",
    "redo",
    "delete-selection",
    "group-selection",
    "ungroup-selection",
    "toggle-theme",
    "toggle-snap",
    "toggle-map-lock",
    "open-github",
    "zoom-in",
    "zoom-out",
    "zoom-reset",
    "tool-move",
    "tool-pan",
    "tool-pen",
    "tool-rectangle",
    "tool-ellipse",
    "tool-polygon",
    "tool-text",
    "tool-pin",
    "tool-arrow",
    "tool-marquee",
    "tool-ruler",
    "tool-paint",
    "tool-image",
    "tool-legend",
    "tool-comment",
];

fn about_metadata() -> AboutMetadata<'static> {
    AboutMetadata {
        name: Some("GeoCarto".into()),
        version: Some(env!("CARGO_PKG_VERSION").into()),
        short_version: Some(format!(
            "{}.{}",
            env!("CARGO_PKG_VERSION_MAJOR"),
            env!("CARGO_PKG_VERSION_MINOR")
        )),
        authors: Some(vec!["Kilian Vivien".into()]),
        comments: Some("A visual-first cartography app".into()),
        license: Some("MIT".into()),
        credits: Some("MIT License - Kilian Vivien".into()),
        ..Default::default()
    }
}

fn item<R: Runtime>(
    app: &AppHandle<R>,
    id: &str,
    label: &str,
    accelerator: Option<&str>,
) -> tauri::Result<MenuItem<R>> {
    MenuItem::with_id(app, id, label, true, accelerator)
}

fn build_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let app_menu = SubmenuBuilder::new(app, "GeoCarto")
        .item(&PredefinedMenuItem::about(
            app,
            Some("About GeoCarto"),
            Some(about_metadata()),
        )?)
        .separator()
        .services()
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        .quit()
        .build()?;

    let file_menu = SubmenuBuilder::new(app, "File")
        .item(&item(
            app,
            "new-project",
            "New Project",
            Some("CmdOrCtrl+N"),
        )?)
        .item(&item(app, "open-project", "Open...", Some("CmdOrCtrl+O"))?)
        .item(&item(
            app,
            "import-data",
            "Import Data...",
            Some("CmdOrCtrl+Shift+O"),
        )?)
        .separator()
        .item(&item(app, "save-project", "Save", Some("CmdOrCtrl+S"))?)
        .item(&item(
            app,
            "save-project-as",
            "Save As...",
            Some("CmdOrCtrl+Shift+S"),
        )?)
        .separator()
        .item(&MenuItem::with_id(
            app,
            "export",
            "Export...",
            false,
            Some("CmdOrCtrl+E"),
        )?)
        .item(&MenuItem::with_id(
            app,
            "share-png",
            "Share PNG",
            false,
            Some("CmdOrCtrl+Shift+E"),
        )?)
        .separator()
        .item(&item(app, "close-tab", "Close Tab", Some("CmdOrCtrl+W"))?)
        .build()?;

    let edit_menu = SubmenuBuilder::new(app, "Edit")
        .item(&item(app, "undo", "Undo", Some("CmdOrCtrl+Z"))?)
        .item(&item(app, "redo", "Redo", Some("CmdOrCtrl+Shift+Z"))?)
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .separator()
        .item(&item(app, "delete-selection", "Delete", Some("Backspace"))?)
        .item(&item(app, "group-selection", "Group", Some("CmdOrCtrl+G"))?)
        .item(&item(
            app,
            "ungroup-selection",
            "Ungroup",
            Some("CmdOrCtrl+Shift+G"),
        )?)
        .build()?;

    let view_menu = SubmenuBuilder::new(app, "View")
        .item(&item(
            app,
            "toggle-theme",
            "Toggle Theme",
            Some("CmdOrCtrl+Shift+T"),
        )?)
        .item(&item(
            app,
            "toggle-snap",
            "Toggle Snap",
            Some("CmdOrCtrl+;"),
        )?)
        .item(&item(
            app,
            "toggle-map-lock",
            "Lock/Unlock Map",
            Some("CmdOrCtrl+L"),
        )?)
        .separator()
        .item(&item(app, "zoom-in", "Zoom In", Some("CmdOrCtrl+="))?)
        .item(&item(app, "zoom-out", "Zoom Out", Some("CmdOrCtrl+-"))?)
        .item(&item(
            app,
            "zoom-reset",
            "Actual Size",
            Some("CmdOrCtrl+0"),
        )?)
        .separator()
        .fullscreen()
        .build()?;

    let tools_menu = SubmenuBuilder::new(app, "Tools")
        .item(&item(app, "tool-move", "Move", Some("V"))?)
        .item(&item(app, "tool-pan", "Pan", Some("H"))?)
        .separator()
        .item(&item(app, "tool-pen", "Line", Some("P"))?)
        .item(&item(app, "tool-rectangle", "Rectangle", Some("R"))?)
        .item(&item(app, "tool-ellipse", "Ellipse", Some("O"))?)
        .item(&item(app, "tool-polygon", "Polygon", Some("G"))?)
        .item(&item(app, "tool-text", "Text", Some("T"))?)
        .item(&item(app, "tool-pin", "Pin", Some("I"))?)
        .item(&item(app, "tool-arrow", "Arrow", Some("A"))?)
        .separator()
        .item(&item(app, "tool-marquee", "Marquee", Some("M"))?)
        .item(&item(app, "tool-ruler", "Ruler", Some("K"))?)
        .item(&item(app, "tool-paint", "Brush", Some("B"))?)
        .item(&item(app, "tool-image", "Image", Some("J"))?)
        .item(&item(app, "tool-legend", "Legend", Some("L"))?)
        .item(&item(app, "tool-comment", "Comment", Some("C"))?)
        .build()?;

    let window_menu = SubmenuBuilder::new(app, "Window")
        .minimize()
        .maximize()
        .separator()
        .bring_all_to_front()
        .build()?;

    let help_menu = SubmenuBuilder::new(app, "Help")
        .item(&item(
            app,
            "open-github",
            "GeoCarto on GitHub",
            Some("CmdOrCtrl+Shift+/"),
        )?)
        .build()?;

    MenuBuilder::new(app)
        .item(&app_menu)
        .item(&file_menu)
        .item(&edit_menu)
        .item(&view_menu)
        .item(&tools_menu)
        .item(&window_menu)
        .item(&help_menu)
        .build()
}

#[tauri::command]
fn set_export_menu_enabled(app: AppHandle, enabled: bool) -> tauri::Result<()> {
    if let Some(menu) = app.menu() {
        for id in ["export", "share-png"] {
            if let Some(MenuItemKind::MenuItem(item)) = menu.get(id) {
                item.set_enabled(enabled)?;
            }
        }
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![set_export_menu_enabled])
        .setup(|app| {
            let menu = build_menu(app.handle())?;
            app.set_menu(menu)?;
            Ok(())
        })
        .on_menu_event(|app, event| {
            let id = event.id().as_ref();
            if APP_COMMAND_IDS.contains(&id) {
                let _ = app.emit("geocarto://menu", id);
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running GeoCarto");
}
