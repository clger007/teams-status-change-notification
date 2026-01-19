# Teams Status Change Notification
THIS IS AN END-TO-END VIBE-CODED PROJECT. 
Just for learning purposes, use it at your own risk.
Get instant notifications on your iPhone when your Microsoft Teams status changes from "Available" to any other status (Away, Busy, Do Not Disturb).

Perfect for remote workers who want to stay aware of their Teams presence status without constantly checking the app.

## Features

- 🔔 **Real-time Status Monitoring** - Detects when your Teams status changes
- 📱 **iPhone Push Notifications** - Instant alerts via Bark app
- 🖥️ **macOS Menubar Integration** - Shows unread message count via xbar
- 🔒 **Privacy-First** - All data stays local, no cloud services
- 🎯 **Lightweight** - Minimal resource usage

## Architecture

```
Teams PWA (Chrome) → Chrome Extension → Rust Server (localhost:9876)
                                              ├─→ xbar Menubar
                                              └─→ Bark API (iPhone)
```

## Prerequisites

- macOS
- Rust toolchain: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- Chrome browser
- [xbar](https://xbarapp.com/) (for menubar display)
- [Bark app](https://apps.apple.com/app/bark-customed-notifications/id1403753468) (for iPhone notifications)

## Installation

### 1. Build the Rust Server

```bash
cargo build --release
```

### 2. Start the Server

```bash
./target/release/teams-notifier &
```

Or set up auto-start on login:
```bash
# Create launchd service (macOS)
cat > ~/Library/LaunchAgents/com.teams-notifier.plist <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.teams-notifier</string>
    <key>ProgramArguments</key>
    <array>
        <string>$(pwd)/target/release/teams-notifier</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
EOF

launchctl load ~/Library/LaunchAgents/com.teams-notifier.plist
```

### 3. Install Chrome Extension

1. Open Chrome: `chrome://extensions/`
2. Enable "Developer mode" (top-right toggle)
3. Click "Load unpacked"
4. Select the `extension/` folder
5. The extension will appear as "Page Translator"

### 4. Configure Bark (iPhone Notifications)

```bash
./setup_bark.sh
```

Follow the prompts to:
1. Install Bark from App Store
2. Copy your device key from the Bark app
3. Choose notification sound
4. Test the notification

### 5. Add xbar Menubar Plugin

1. Open xbar Preferences
2. Click "+" to add plugin
3. Select `menubar_teams.10s.py`
4. The Teams status will appear in your menubar

## Usage

### Status Monitoring

The extension monitors your Teams status every 5 seconds. When your status changes from "Available" to any other status (Away, Busy, Do Not Disturb), you'll receive:

- 📱 Push notification on your iPhone (via Bark)
- 🖥️ Update in the menubar (via xbar)

### Menubar Display

- **Teams 🟢** - No unread messages, status available
- **Teams 🔴 3** - 3 unread messages
- Click to see recent notifications and reset count

### Configuration

All configuration is stored in your home directory:
- `~/.teams_notifier_state.json` - Notification state
- `~/.teams_notifier_bark.json` - Bark device key and settings
- `~/.teams_notifier_status_alert.json` - Status alert enabled/disabled

## API Endpoints

The Rust server exposes these endpoints on `http://localhost:9876`:

- `POST /notification` - Receive notification events
- `GET /status` - Get current notification state
- `POST /reset` - Reset unread count
- `GET/POST /bark/config` - Bark configuration
- `GET/POST /statusalert/config` - Status alert toggle

## Privacy & Security

- ✅ All data stays on your local machine
- ✅ Server runs on localhost only (no network exposure)
- ✅ Extension only monitors Teams tab DOM
- ✅ No data collection or analytics
- ✅ Open source - audit the code yourself

## Note on Keep-Alive Features

Some tools simulate user activity to prevent automatic "Away" status. **This project does NOT include such features** as they may violate company policies. We focus solely on monitoring and notification.

If you're interested in preventing automatic status changes, consider:
- Adjusting your Teams settings for longer idle timeouts
- Using physical mouse jigglers (hardware solution)
- Checking your company's policy on availability tools

## Troubleshooting

### Extension not monitoring Teams

1. Ensure Teams is open in Chrome
2. Check Chrome console (F12) for errors
3. Verify extension is enabled at `chrome://extensions/`

### Server offline

1. Check if server is running: `ps aux | grep teams-notifier`
2. Start it: `./target/release/teams-notifier &`
3. Verify port: `curl http://localhost:9876/status`

### Notifications not working

1. Verify Bark is configured: `curl http://localhost:9876/bark/config`
2. Test Bark directly: `curl "https://api.day.app/YOUR_KEY/Test/Message"`
3. Check server logs for errors

## Development

### Project Structure

```
teams-status-change-notification/
├── src/
│   └── main.rs              # Rust HTTP server (Axum)
├── extension/
│   ├── manifest.json        # Chrome extension config
│   ├── background.js        # Service worker (DOM monitoring)
│   ├── popup.html/js        # Extension popup UI
│   └── icon-*.png           # Extension icons
├── menubar_teams.10s.py     # xbar plugin
├── setup_bark.sh            # Bark configuration script
└── Cargo.toml               # Rust dependencies
```

### Tech Stack

- **Backend**: Rust + Axum + Tokio
- **Extension**: Chrome Manifest V3
- **Menubar**: Python 3 + xbar
- **Notifications**: Bark API

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Submit a pull request

## License

MIT License - feel free to use and modify as needed.

## Disclaimer

This tool is for personal use to monitor your own Teams status. Users are responsible for ensuring compliance with their organization's policies. The authors are not responsible for any policy violations or consequences from using this tool.

## Support

If you find this useful, consider:
- ⭐ Starring the repository
- 🐛 Reporting bugs via Issues
- 💡 Suggesting features

---

**Made with ❤️ for remote workers who want to stay aware of their Teams presence**
