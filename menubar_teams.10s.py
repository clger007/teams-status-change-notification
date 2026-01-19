#!/usr/bin/env python3
# <xbar.title>Teams Notifier</xbar.title>
# <xbar.version>2.0.0</xbar.version>
# <xbar.author>Your Name</xbar.author>
# <xbar.desc>Shows Microsoft Teams unread notification count</xbar.desc>
# <xbar.dependencies>python3</xbar.dependencies>

import json
from pathlib import Path
from datetime import datetime
import urllib.request
import urllib.error

STATE_FILE = Path.home() / ".teams_notifier_state.json"


def get_state_from_file():
    if STATE_FILE.exists():
        with open(STATE_FILE, "r") as f:
            return json.load(f)
    return {"count": 0, "last_notification": None, "history": []}


def get_state_from_server():
    try:
        with urllib.request.urlopen(
            "http://localhost:9876/status", timeout=2
        ) as response:
            return json.loads(response.read())
    except (urllib.error.URLError, json.JSONDecodeError):
        return None


def reset_count():
    try:
        req = urllib.request.Request(
            "http://localhost:9876/reset", data=b"", method="POST"
        )
        with urllib.request.urlopen(req, timeout=2) as response:
            return True
    except urllib.error.URLError:
        return False


def format_output(state):
    count = state.get("count", 0)
    last = state.get("last_notification", {})
    history = state.get("history", [])

    if count == 0:
        print("Teams 🟢 | size=12")
    else:
        print(f"Teams 🔴 {count} | size=12 color=red")

    print("---")
    print(f"Unread: {count}")
    print("---")

    if last:
        title = last.get("title", "N/A")
        msg = last.get("message", "")
        if msg and msg != title:
            print(f"Last: {title}")
            print(f"-- {msg[:60]}")
        elif title:
            print(f"Last: {title}")

    print("---")
    print("Refresh | refresh=true")
    print(
        "Reset Count | bash=/usr/bin/python3 param1=-c param2=\"import urllib.request; urllib.request.urlopen('http://localhost:9876/reset', data=b'', method='POST')\""
    )

    if history:
        print("---")
        print("Recent:")
        for idx, item in enumerate(reversed(history[-5:])):
            try:
                ts_ms = item.get("timestamp", 0)
                # Convert milliseconds to seconds
                ts_sec = ts_ms / 1000 if ts_ms > 0 else 0
                ts = datetime.fromtimestamp(ts_sec).strftime("%H:%M")
            except (ValueError, OSError):
                ts = "??:??"

            title = item.get("title", "N/A")
            msg = item.get("message", "")
            if msg and msg != title:
                print(f"{idx + 1}. [{ts}] {title}")
                print(f"   {msg[:50]}...")
            else:
                print(f"{idx + 1}. [{ts}] {title}")


if __name__ == "__main__":
    state = get_state_from_server() or get_state_from_file()

    if not state:
        print("Teams ❌ | size=12")
        print("---")
        print("Server offline")
        print("---")
        print("Refresh | refresh=true")
    else:
        format_output(state)
