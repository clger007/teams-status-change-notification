#!/bin/bash
echo "=== Bark Setup for Teams Notifier ==="
echo ""
echo "Step 1: Install Bark on your iPhone"
echo "Download from App Store: https://apps.apple.com/app/bark-customed-notifications/id1403753468"
echo ""
echo "Step 2: Get your Bark device key"
echo "Open Bark app → Tap the info icon → Copy your device key"
echo ""
read -p "Enter your Bark device key: " DEVICE_KEY
echo ""
echo "Step 3: Select notification sound (optional)"
echo "Options: multiwayinvitation, healthnotification, antic"
read -p "Sound [multiwayinvitation]: " SOUND
SOUND=${SOUND:-multiwayinvitation}
echo ""
echo "Step 4: Save configuration"
cat > ~/.teams_notifier_bark.json <<EOF
{
  "device_key": "$DEVICE_KEY",
  "sound": "$SOUND",
  "group": "teams-notifier"
}
EOF

echo "✅ Bark configuration saved to ~/.teams_notifier_bark.json"
echo ""
echo "Testing configuration..."
curl -s -X POST http://localhost:9876/bark/config \
  -H "Content-Type: application/json" \
  -d "{\"device_key\":\"$DEVICE_KEY\",\"sound\":\"$SOUND\",\"group\":\"teams-notifier\"}"

echo ""
echo "Step 5: Test notification"
read -p "Send test notification? (y/n): " TEST
if [[ "$TEST" == "y" || "$TEST" == "Y" ]]; then
    echo "Sending test notification..."
    curl -s "https://api.day.app/$DEVICE_KEY/Teams%20Notifier/Test%20notification" \
      -d "sound=$SOUND" \
      -d "group=teams-notifier" \
      -d "icon=https://statics.teams.cdn.office.net/evergreen-assets/apps/favicon.ico"
    echo ""
    echo "Check your iPhone for notification!"
fi

echo ""
echo "Setup complete! Teams notifications will now be pushed to your iPhone."
