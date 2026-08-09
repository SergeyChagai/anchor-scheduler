//! The Tauri shell. It deliberately holds no logic: the scheduling engine and
//! the whole UI are the web surface, and this is the window around it. Keeping
//! it empty is what lets the desktop and (later) mobile targets stay honest
//! ports rather than forks.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running anchor-scheduler");
}
