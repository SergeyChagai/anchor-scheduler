// Release builds open the app, not a console window behind it.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    anchor_scheduler_lib::run()
}
