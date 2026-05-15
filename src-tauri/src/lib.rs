#[tauri::command]
fn get_backend_info() -> serde_json::Value {
    #[cfg(debug_assertions)]
    {
        serde_json::json!({
            "port": 8000,
            "token": "dev-token-123"
        })
    }
    #[cfg(not(debug_assertions))]
    {
        serde_json::json!({
            "port": 8000,
            "token": "dev-token-123"
        })
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![get_backend_info])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
