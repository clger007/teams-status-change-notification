use axum::{
    extract::{Json, State},
    http::StatusCode,
    response::Json as ResponseJson,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::{fs, path::PathBuf};
use tokio::net::TcpListener;
use tower_http::cors::{CorsLayer, Any};

#[derive(Clone, Serialize, Deserialize)]
struct NotificationEvent {
    #[serde(rename = "type")]
    event_type: String,
    count: i32,
    previous_count: Option<i32>,
    title: String,
    message: String,
    timestamp: i64,
}

#[derive(Clone, Serialize, Deserialize)]
struct NotificationState {
    count: i32,
    last_notification: Option<NotificationEvent>,
    history: Vec<NotificationEvent>,
    last_pushed_count: i32,
}

#[derive(Clone, Serialize, Deserialize)]
struct BarkConfig {
    device_key: String,
    server_url: String,
    sound: String,
    group: String,
}

#[derive(Clone, Serialize, Deserialize)]
struct KeepAliveConfig {
    enabled: bool,
}

#[derive(Clone, Serialize, Deserialize)]
struct StatusAlertConfig {
    enabled: bool,
}

struct AppState {
    state: Mutex<NotificationState>,
    bark_config: Mutex<BarkConfig>,
    keep_alive_config: Mutex<KeepAliveConfig>,
    status_alert_config: Mutex<StatusAlertConfig>,
}

async fn send_bark_notification(
    config: BarkConfig,
    title: String,
    body: String,
    badge: i32,
) -> anyhow::Result<()> {
    let client = reqwest::Client::new();

    let url = format!(
        "https://api.day.app/{}/{}/{}",
        urlencoding::encode(&config.device_key),
        urlencoding::encode(&title),
        urlencoding::encode(&body)
    );

    let url_with_params = format!(
        "{}?sound={}&group={}&badge={}&icon={}",
        url,
        urlencoding::encode(&config.sound),
        urlencoding::encode(&config.group),
        badge,
        urlencoding::encode("https://statics.teams.cdn.office.net/evergreen-assets/apps/favicon.ico")
    );

    let response = client.get(&url_with_params).send().await?;

    if response.status().is_success() {
        println!("✅ Bark notification sent: {}", title);
    } else {
        return Err(anyhow::anyhow!("Bark notification failed: {}", response.status()));
    }

    Ok(())
}

async fn notification_handler(
    State(state): State<Arc<AppState>>,
    Json(event): Json<NotificationEvent>,
) -> Result<ResponseJson<String>, StatusCode> {
    let mut notification_state = state.state.lock().unwrap();

    notification_state.count = event.count;
    notification_state.last_notification = Some(event.clone());

    notification_state.history.insert(0, event.clone());
    if notification_state.history.len() > 10 {
        notification_state.history.pop();
    }

    let bark_config = state.bark_config.lock().unwrap();

    // Send Bark notification for status alerts OR when count increases
    let should_send_bark = !bark_config.device_key.is_empty() && (
        event.event_type == "status_away" ||
        event.count > notification_state.last_pushed_count
    );

    if should_send_bark {
        drop(notification_state);
        drop(bark_config);

        let bark_config = state.bark_config.lock().unwrap();
        let config = bark_config.clone();
        drop(bark_config);

        let state_copy = state.clone();
        let is_status_alert = event.event_type == "status_away";
        tokio::spawn(async move {
            let badge = event.count;
            match send_bark_notification(
                config,
                event.title.clone(),
                event.message.clone(),
                badge,
            )
            .await
            {
                Ok(_) => {
                    if !is_status_alert {
                        let mut s = state_copy.state.lock().unwrap();
                        s.last_pushed_count = badge;
                        println!("✅ Updated last_pushed_count to {}", badge);
                    } else {
                        println!("✅ Sent status alert notification");
                    }
                }
                Err(e) => {
                    eprintln!("❌ Failed to send Bark notification: {}", e);
                }
            }
        });
    }

    Ok(ResponseJson(String::from("OK")))
}

async fn status_handler(State(state): State<Arc<AppState>>) -> ResponseJson<NotificationState> {
    let notification_state = state.state.lock().unwrap().clone();
    ResponseJson(notification_state)
}

async fn reset_handler(State(state): State<Arc<AppState>>) -> ResponseJson<serde_json::Value> {
    let mut notification_state = state.state.lock().unwrap();
    notification_state.count = 0;
    notification_state.last_pushed_count = 0;
    ResponseJson(serde_json::json!({ "status": "reset" }))
}

async fn bark_config_get_handler(
    State(state): State<Arc<AppState>>,
) -> ResponseJson<serde_json::Value> {
    let bark_config = state.bark_config.lock().unwrap().clone();
    ResponseJson(serde_json::json!({
        "configured": !bark_config.device_key.is_empty(),
        "device_key": if bark_config.device_key.is_empty() { None } else { Some(bark_config.device_key) },
        "server_url": bark_config.server_url,
        "sound": bark_config.sound,
        "group": bark_config.group
    }))
}

async fn bark_config_post_handler(
    State(state): State<Arc<AppState>>,
    Json(config): Json<BarkConfig>,
) -> ResponseJson<serde_json::Value> {
    let mut bark_config = state.bark_config.lock().unwrap();
    *bark_config = config;

    ResponseJson(serde_json::json!({ "status": "updated" }))
}

async fn keep_alive_config_get_handler(
    State(state): State<Arc<AppState>>,
) -> ResponseJson<serde_json::Value> {
    let keep_alive_config = state.keep_alive_config.lock().unwrap().clone();
    ResponseJson(serde_json::json!({
        "enabled": keep_alive_config.enabled
    }))
}

async fn keep_alive_config_post_handler(
    State(state): State<Arc<AppState>>,
    Json(config): Json<KeepAliveConfig>,
) -> ResponseJson<serde_json::Value> {
    let mut keep_alive_config = state.keep_alive_config.lock().unwrap();
    *keep_alive_config = config;

    ResponseJson(serde_json::json!({ "status": "updated" }))
}

async fn status_alert_config_get_handler(
    State(state): State<Arc<AppState>>,
) -> ResponseJson<serde_json::Value> {
    let status_alert_config = state.status_alert_config.lock().unwrap().clone();
    ResponseJson(serde_json::json!({
        "enabled": status_alert_config.enabled
    }))
}

async fn status_alert_config_post_handler(
    State(state): State<Arc<AppState>>,
    Json(config): Json<StatusAlertConfig>,
) -> ResponseJson<serde_json::Value> {
    let mut status_alert_config = state.status_alert_config.lock().unwrap();
    *status_alert_config = config;

    ResponseJson(serde_json::json!({ "status": "updated" }))
}

fn get_state_file_path() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home).join(".teams_notifier_state.json")
}

fn get_bark_config_file_path() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home).join(".teams_notifier_bark.json")
}

fn get_keep_alive_config_file_path() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home).join(".teams_notifier_keepalive.json")
}

fn get_status_alert_config_file_path() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home).join(".teams_notifier_status_alert.json")
}

fn load_state_from_file() -> NotificationState {
    let path = get_state_file_path();
    if path.exists() {
        match fs::read_to_string(&path) {
            Ok(content) => match serde_json::from_str(&content) {
                Ok(state) => return state,
                Err(e) => eprintln!("Warning: Failed to parse state file: {}", e),
            },
            Err(e) => eprintln!("Warning: Failed to read state file: {}", e),
        }
    }
    NotificationState {
        count: 0,
        last_notification: None,
        history: Vec::new(),
        last_pushed_count: 0,
    }
}

fn save_state_to_file(state: &NotificationState) {
    let path = get_state_file_path();
    if let Ok(content) = serde_json::to_string_pretty(state) {
        if let Err(e) = fs::write(&path, content) {
            eprintln!("Warning: Failed to write state file: {}", e);
        }
    }
}

fn load_bark_config_from_file() -> BarkConfig {
    let path = get_bark_config_file_path();
    if path.exists() {
        match fs::read_to_string(&path) {
            Ok(content) => match serde_json::from_str(&content) {
                Ok(config) => return config,
                Err(e) => eprintln!("Warning: Failed to parse Bark config file: {}", e),
            },
            Err(e) => eprintln!("Warning: Failed to read Bark config file: {}", e),
        }
    }
    BarkConfig {
        device_key: String::new(),
        server_url: String::new(),
        sound: "minuet".to_string(),
        group: "teams".to_string(),
    }
}

fn save_bark_config_to_file(config: &BarkConfig) {
    let path = get_bark_config_file_path();
    if let Ok(content) = serde_json::to_string_pretty(config) {
        if let Err(e) = fs::write(&path, content) {
            eprintln!("Warning: Failed to write Bark config file: {}", e);
        }
    }
}

fn load_keep_alive_config_from_file() -> KeepAliveConfig {
    let path = get_keep_alive_config_file_path();
    if path.exists() {
        match fs::read_to_string(&path) {
            Ok(content) => match serde_json::from_str(&content) {
                Ok(config) => return config,
                Err(e) => eprintln!("Warning: Failed to parse keep-alive config file: {}", e),
            },
            Err(e) => eprintln!("Warning: Failed to read keep-alive config file: {}", e),
        }
    }
    KeepAliveConfig { enabled: false }
}

fn save_keep_alive_config_to_file(config: &KeepAliveConfig) {
    let path = get_keep_alive_config_file_path();
    if let Ok(content) = serde_json::to_string_pretty(config) {
        if let Err(e) = fs::write(&path, content) {
            eprintln!("Warning: Failed to write keep-alive config file: {}", e);
        }
    }
}

fn load_status_alert_config_from_file() -> StatusAlertConfig {
    let path = get_status_alert_config_file_path();
    if path.exists() {
        match fs::read_to_string(&path) {
            Ok(content) => match serde_json::from_str(&content) {
                Ok(config) => return config,
                Err(e) => eprintln!("Warning: Failed to parse status alert config file: {}", e),
            },
            Err(e) => eprintln!("Warning: Failed to read status alert config file: {}", e),
        }
    }
    StatusAlertConfig { enabled: false }
}

fn save_status_alert_config_to_file(config: &StatusAlertConfig) {
    let path = get_status_alert_config_file_path();
    if let Ok(content) = serde_json::to_string_pretty(config) {
        if let Err(e) = fs::write(&path, content) {
            eprintln!("Warning: Failed to write status alert config file: {}", e);
        }
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    println!("🚀 Starting Teams Notification Listener...");

    let state = load_state_from_file();
    let bark_config = load_bark_config_from_file();
    let keep_alive_config = load_keep_alive_config_from_file();
    let status_alert_config = load_status_alert_config_from_file();

    let app_state = Arc::new(AppState {
        state: Mutex::new(state),
        bark_config: Mutex::new(bark_config),
        keep_alive_config: Mutex::new(keep_alive_config),
        status_alert_config: Mutex::new(status_alert_config),
    });

    let app_state_clone = app_state.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(30));
        loop {
            interval.tick().await;
            let state = app_state_clone.state.lock().unwrap().clone();
            save_state_to_file(&state);
            println!("💾 State saved to file");
        }
    });

    let app_state_clone_for_bark = app_state.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(60));
        loop {
            interval.tick().await;
            let bark_config = app_state_clone_for_bark.bark_config.lock().unwrap().clone();
            save_bark_config_to_file(&bark_config);
        }
    });

    let app_state_clone_for_keepalive = app_state.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(60));
        loop {
            interval.tick().await;
            let keep_alive_config = app_state_clone_for_keepalive.keep_alive_config.lock().unwrap().clone();
            save_keep_alive_config_to_file(&keep_alive_config);
        }
    });

    let app_state_clone_for_status_alert = app_state.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(60));
        loop {
            interval.tick().await;
            let status_alert_config = app_state_clone_for_status_alert.status_alert_config.lock().unwrap().clone();
            save_status_alert_config_to_file(&status_alert_config);
        }
    });

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/notification", post(notification_handler))
        .route("/status", get(status_handler))
        .route("/reset", post(reset_handler))
        .route("/bark/config", get(bark_config_get_handler).post(bark_config_post_handler))
        .route("/keepalive/config", get(keep_alive_config_get_handler).post(keep_alive_config_post_handler))
        .route("/statusalert/config", get(status_alert_config_get_handler).post(status_alert_config_post_handler))
        .layer(cors)
        .with_state(app_state);

    let listener = TcpListener::bind("127.0.0.1:9876").await?;
    println!("📡 Server listening on http://127.0.0.1:9876");

    axum::serve(listener, app).await?;

    Ok(())
}
