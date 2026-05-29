// Prevents an extra console window on Windows in release builds. No-op on macOS.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    geocarto_lib::run()
}
