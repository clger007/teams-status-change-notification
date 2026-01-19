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
