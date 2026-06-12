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
    "open-settings",
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

/// Pick the English or French label for the current menu language. The web i18n
/// store is the source of truth for the app language; it pushes the resolved
/// locale to Rust via the `set_menu_locale` command, which rebuilds the menu.
/// Predefined items default to the macOS/app-bundle language, which can differ
/// from GeoCarto's in-app locale. Use Tauri's explicit text variants so the
/// native menu follows the app language chosen in the web shell.
fn tr(lang: &str, en: &'static str, fr: &'static str) -> &'static str {
    if lang == "fr" {
        fr
    } else {
        en
    }
}

fn about_metadata(lang: &str) -> AboutMetadata<'static> {
    AboutMetadata {
        name: Some("GeoCarto".into()),
        version: Some(env!("CARGO_PKG_VERSION").into()),
        short_version: Some(format!(
            "{}.{}",
            env!("CARGO_PKG_VERSION_MAJOR"),
            env!("CARGO_PKG_VERSION_MINOR")
        )),
        authors: Some(vec!["Kilian Vivien".into()]),
        comments: Some(
            tr(
                lang,
                "A visual-first cartography app",
                "Une application de cartographie visuelle",
            )
            .into(),
        ),
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

fn build_menu<R: Runtime>(app: &AppHandle<R>, lang: &str) -> tauri::Result<Menu<R>> {
    let app_menu = SubmenuBuilder::new(app, "GeoCarto")
        .item(&PredefinedMenuItem::about(
            app,
            Some(tr(lang, "About GeoCarto", "À propos de GeoCarto")),
            Some(about_metadata(lang)),
        )?)
        .separator()
        .item(&item(
            app,
            "open-settings",
            tr(lang, "Settings...", "Réglages…"),
            Some("CmdOrCtrl+,"),
        )?)
        .separator()
        .services_with_text(tr(lang, "Services", "Services"))
        .separator()
        .hide_with_text(tr(lang, "Hide GeoCarto", "Masquer GeoCarto"))
        .hide_others_with_text(tr(lang, "Hide Others", "Masquer les autres"))
        .show_all_with_text(tr(lang, "Show All", "Tout afficher"))
        .separator()
        .quit_with_text(tr(lang, "Quit GeoCarto", "Quitter GeoCarto"))
        .build()?;

    let file_menu = SubmenuBuilder::new(app, tr(lang, "File", "Fichier"))
        .item(&item(
            app,
            "new-project",
            tr(lang, "New Project", "Nouveau projet"),
            Some("CmdOrCtrl+N"),
        )?)
        .item(&item(
            app,
            "open-project",
            tr(lang, "Open...", "Ouvrir…"),
            Some("CmdOrCtrl+O"),
        )?)
        .item(&item(
            app,
            "import-data",
            tr(lang, "Import Data...", "Importer des données…"),
            Some("CmdOrCtrl+Shift+O"),
        )?)
        .separator()
        .item(&item(
            app,
            "save-project",
            tr(lang, "Save", "Enregistrer"),
            Some("CmdOrCtrl+S"),
        )?)
        .item(&item(
            app,
            "save-project-as",
            tr(lang, "Save As...", "Enregistrer sous…"),
            Some("CmdOrCtrl+Shift+S"),
        )?)
        .separator()
        .item(&MenuItem::with_id(
            app,
            "export",
            tr(lang, "Export...", "Exporter…"),
            false,
            Some("CmdOrCtrl+E"),
        )?)
        .item(&MenuItem::with_id(
            app,
            "share-png",
            tr(lang, "Share PNG", "Partager en PNG"),
            false,
            Some("CmdOrCtrl+Shift+E"),
        )?)
        .separator()
        .item(&item(
            app,
            "close-tab",
            tr(lang, "Close Tab", "Fermer l’onglet"),
            Some("CmdOrCtrl+W"),
        )?)
        .build()?;

    let edit_menu = SubmenuBuilder::new(app, tr(lang, "Edit", "Édition"))
        .item(&item(
            app,
            "undo",
            tr(lang, "Undo", "Annuler"),
            Some("CmdOrCtrl+Z"),
        )?)
        .item(&item(
            app,
            "redo",
            tr(lang, "Redo", "Rétablir"),
            Some("CmdOrCtrl+Shift+Z"),
        )?)
        .separator()
        .cut_with_text(tr(lang, "Cut", "Couper"))
        .copy_with_text(tr(lang, "Copy", "Copier"))
        .paste_with_text(tr(lang, "Paste", "Coller"))
        .select_all_with_text(tr(lang, "Select All", "Tout sélectionner"))
        .separator()
        .item(&item(
            app,
            "delete-selection",
            tr(lang, "Delete", "Supprimer"),
            Some("Backspace"),
        )?)
        .item(&item(
            app,
            "group-selection",
            tr(lang, "Group", "Grouper"),
            Some("CmdOrCtrl+G"),
        )?)
        .item(&item(
            app,
            "ungroup-selection",
            tr(lang, "Ungroup", "Dégrouper"),
            Some("CmdOrCtrl+Shift+G"),
        )?)
        .build()?;

    let view_menu = SubmenuBuilder::new(app, tr(lang, "View", "Affichage"))
        .item(&item(
            app,
            "open-command-palette",
            tr(lang, "Command Palette", "Palette de commandes"),
            Some("CmdOrCtrl+K"),
        )?)
        .separator()
        .item(&item(
            app,
            "toggle-theme",
            tr(lang, "Toggle Theme", "Basculer le thème"),
            Some("CmdOrCtrl+Shift+T"),
        )?)
        .item(&item(
            app,
            "toggle-snap",
            tr(lang, "Toggle Snap", "Basculer l’accrochage"),
            Some("CmdOrCtrl+;"),
        )?)
        .item(&item(
            app,
            "toggle-map-lock",
            tr(
                lang,
                "Lock/Unlock Map",
                "Verrouiller/Déverrouiller la carte",
            ),
            Some("CmdOrCtrl+L"),
        )?)
        .separator()
        .item(&item(
            app,
            "zoom-in",
            tr(lang, "Zoom In", "Zoomer"),
            Some("CmdOrCtrl+="),
        )?)
        .item(&item(
            app,
            "zoom-out",
            tr(lang, "Zoom Out", "Dézoomer"),
            Some("CmdOrCtrl+-"),
        )?)
        .item(&item(
            app,
            "zoom-reset",
            tr(lang, "Actual Size", "Taille réelle"),
            Some("CmdOrCtrl+0"),
        )?)
        .separator()
        .fullscreen_with_text(tr(
            lang,
            "Toggle Full Screen",
            "Activer/Désactiver le plein écran",
        ))
        .build()?;

    let tools_menu = SubmenuBuilder::new(app, tr(lang, "Tools", "Outils"))
        .item(&item(
            app,
            "tool-move",
            tr(lang, "Move", "Déplacer"),
            Some("V"),
        )?)
        .item(&item(
            app,
            "tool-pan",
            tr(lang, "Pan", "Panoramique"),
            Some("H"),
        )?)
        .separator()
        .item(&item(
            app,
            "tool-pen",
            tr(lang, "Line", "Ligne"),
            Some("P"),
        )?)
        .item(&item(
            app,
            "tool-rectangle",
            tr(lang, "Rectangle", "Rectangle"),
            Some("R"),
        )?)
        .item(&item(
            app,
            "tool-ellipse",
            tr(lang, "Ellipse", "Ellipse"),
            Some("O"),
        )?)
        .item(&item(
            app,
            "tool-polygon",
            tr(lang, "Polygon", "Polygone"),
            Some("G"),
        )?)
        .item(&item(
            app,
            "tool-text",
            tr(lang, "Text", "Texte"),
            Some("T"),
        )?)
        .item(&item(
            app,
            "tool-pin",
            tr(lang, "Pin", "Épingle"),
            Some("I"),
        )?)
        .item(&item(
            app,
            "tool-arrow",
            tr(lang, "Arrow", "Flèche"),
            Some("A"),
        )?)
        .separator()
        .item(&item(
            app,
            "tool-marquee",
            tr(lang, "Marquee", "Sélection"),
            Some("M"),
        )?)
        .item(&item(
            app,
            "tool-ruler",
            tr(lang, "Ruler", "Règle"),
            Some("K"),
        )?)
        .item(&item(
            app,
            "tool-paint",
            tr(lang, "Brush", "Pinceau"),
            Some("B"),
        )?)
        .item(&item(
            app,
            "tool-image",
            tr(lang, "Image", "Image"),
            Some("J"),
        )?)
        .item(&item(
            app,
            "tool-legend",
            tr(lang, "Legend", "Légende"),
            Some("L"),
        )?)
        .item(&item(
            app,
            "tool-comment",
            tr(lang, "Comment", "Commentaire"),
            Some("C"),
        )?)
        .build()?;

    let window_menu = SubmenuBuilder::new(app, tr(lang, "Window", "Fenêtre"))
        .minimize_with_text(tr(lang, "Minimize", "Réduire"))
        .maximize_with_text(tr(lang, "Zoom", "Agrandir/Réduire"))
        .separator()
        .bring_all_to_front_with_text(tr(
            lang,
            "Bring All to Front",
            "Tout ramener au premier plan",
        ))
        .build()?;

    let help_menu = SubmenuBuilder::new(app, tr(lang, "Help", "Aide"))
        .item(&item(
            app,
            "open-github",
            tr(lang, "GeoCarto on GitHub", "GeoCarto sur GitHub"),
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

/// Rebuild the native menu in the given language. Called by the web i18n store
/// (the source of truth for the app language) whenever the resolved locale
/// changes. Rebuilding resets the Export/Share items to disabled, so the web
/// re-applies their enabled state via `set_export_menu_enabled` afterwards.
#[tauri::command]
fn set_menu_locale(app: AppHandle, locale: String) -> tauri::Result<()> {
    let menu = build_menu(&app, &locale)?;
    app.set_menu(menu)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            set_export_menu_enabled,
            set_menu_locale
        ])
        .setup(|app| {
            // Default to English; the web shell pushes the resolved locale via
            // `set_menu_locale` as soon as it mounts.
            let menu = build_menu(app.handle(), "en")?;
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
