const STATUS_URL = 'http://localhost:9876/status';
const BARK_CONFIG_URL = 'http://localhost:9876/bark/config';
const KEEPALIVE_CONFIG_URL = 'http://localhost:9876/keepalive/config';
const STATUSALERT_CONFIG_URL = 'http://localhost:9876/statusalert/config';

async function checkStatus() {
  const dot = document.getElementById('statusDot');
  const title = document.getElementById('statusTitle');
  const subtitle = document.getElementById('statusSubtitle');

  try {
    const response = await fetch(STATUS_URL, {
      method: 'GET',
      cache: 'no-cache'
    });

    if (response.ok) {
      const data = await response.json();
      const count = data.count || 0;

      dot.className = 'dot green';
      title.textContent = 'Connected';
      subtitle.textContent = `${count} unread message${count !== 1 ? 's' : ''}`;

      updateIcon('green');
    } else {
      throw new Error('Server error');
    }
  } catch (error) {
    dot.className = 'dot red';
    title.textContent = 'Disconnected';
    subtitle.textContent = 'Server not responding';
    updateIcon('red');
  }
}

async function checkBarkConfig() {
  const barkStatus = document.getElementById('barkStatus');

  try {
    const response = await fetch(BARK_CONFIG_URL, {
      method: 'GET',
      cache: 'no-cache'
    });

    if (response.ok) {
      const data = await response.json();
      if (data.configured) {
        barkStatus.textContent = '✅ Configured';
        barkStatus.style.color = '#10b981';
      } else {
        barkStatus.textContent = '⚠️ Not configured';
        barkStatus.style.color = '#f59e0b';
      }
    } else {
      throw new Error('Server error');
    }
  } catch (error) {
    barkStatus.textContent = '❓ Unknown';
    barkStatus.style.color = '#6b7280';
  }
}

async function checkKeepAliveConfig() {
  const toggle = document.getElementById('keepAliveToggle');
  const status = document.getElementById('keepAliveStatus');

  try {
    const response = await fetch(KEEPALIVE_CONFIG_URL, {
      method: 'GET',
      cache: 'no-cache'
    });

    if (response.ok) {
      const data = await response.json();
      toggle.checked = data.enabled;
      status.textContent = data.enabled ? 'On' : 'Off';
      status.style.color = data.enabled ? '#10b981' : '#6b7280';
    } else {
      throw new Error('Server error');
    }
  } catch (error) {
    toggle.checked = false;
    status.textContent = 'Unknown';
    status.style.color = '#6b7280';
  }
}

async function toggleKeepAlive(enabled) {
  try {
    const response = await fetch(KEEPALIVE_CONFIG_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: enabled }),
      cache: 'no-cache'
    });

    if (!response.ok) {
      throw new Error('Failed to update keep-alive setting');
    }

    chrome.runtime.sendMessage({ type: 'keep_alive_toggle', enabled: enabled });
  } catch (error) {
    console.error('Error toggling keep-alive:', error);
    const toggle = document.getElementById('keepAliveToggle');
    toggle.checked = !enabled;
  }
}

async function checkStatusAlertConfig() {
  const toggle = document.getElementById('statusAlertToggle');
  const status = document.getElementById('statusAlertStatus');

  try {
    const response = await fetch(STATUSALERT_CONFIG_URL, {
      method: 'GET',
      cache: 'no-cache'
    });

    if (response.ok) {
      const data = await response.json();
      toggle.checked = data.enabled;
      status.textContent = data.enabled ? 'On' : 'Off';
      status.style.color = data.enabled ? '#10b981' : '#6b7280';
    } else {
      throw new Error('Server error');
    }
  } catch (error) {
    toggle.checked = false;
    status.textContent = 'Unknown';
    status.style.color = '#6b7280';
  }
}

async function toggleStatusAlert(enabled) {
  try {
    const response = await fetch(STATUSALERT_CONFIG_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: enabled }),
      cache: 'no-cache'
    });

    if (!response.ok) {
      throw new Error('Failed to update status alert setting');
    }

    chrome.runtime.sendMessage({ type: 'status_alert_toggle', enabled: enabled });
  } catch (error) {
    console.error('Error toggling status alert:', error);
    const toggle = document.getElementById('statusAlertToggle');
    toggle.checked = !enabled;
  }
}

function updateIcon(color) {
  const iconPath = {
    green: 'icon-green-48.png',
    red: 'icon-red-48.png',
    grey: 'icon-grey-48.png'
  };

  chrome.action.setIcon({
    path: {
      16: `icon-${color}-16.png`,
      48: `icon-${color}-48.png`,
      128: `icon-${color}-128.png`
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  checkStatus();
  checkBarkConfig();
  checkKeepAliveConfig();
  checkStatusAlertConfig();

  document.getElementById('refreshBtn').addEventListener('click', () => {
    checkStatus();
    checkBarkConfig();
    checkKeepAliveConfig();
    checkStatusAlertConfig();
  });

  document.getElementById('configureBark').addEventListener('click', () => {
    chrome.tabs.create({
      url: 'file:///Users/kencheligeer/projects/team_hack/teams-notification-listener-native/setup_bark.sh'
    });
  });

  document.getElementById('keepAliveToggle').addEventListener('change', (e) => {
    const enabled = e.target.checked;
    toggleKeepAlive(enabled);
    const status = document.getElementById('keepAliveStatus');
    status.textContent = enabled ? 'On' : 'Off';
    status.style.color = enabled ? '#10b981' : '#6b7280';
  });

  document.getElementById('statusAlertToggle').addEventListener('change', (e) => {
    const enabled = e.target.checked;
    toggleStatusAlert(enabled);
    const status = document.getElementById('statusAlertStatus');
    status.textContent = enabled ? 'On' : 'Off';
    status.style.color = enabled ? '#10b981' : '#6b7280';
  });

  chrome.tabs.onActivated.addListener(() => {
    checkStatus();
    checkBarkConfig();
    checkKeepAliveConfig();
    checkStatusAlertConfig();
  });
});
