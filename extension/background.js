let teamsTabId = null;
let keepAliveEnabled = false;
let keepAliveIntervalId = null;
let statusAlertEnabled = false;

chrome.runtime.onStartup.addListener(() => {
  findTeamsTab();
  loadKeepAliveState();
  loadStatusAlertState();
});

chrome.runtime.onInstalled.addListener(() => {
  findTeamsTab();
  loadKeepAliveState();
  loadStatusAlertState();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'keep_alive_toggle') {
    setKeepAliveEnabled(message.enabled);
  } else if (message.type === 'status_alert_toggle') {
    setStatusAlertEnabled(message.enabled);
  }
});

function loadKeepAliveState() {
  chrome.storage.sync.get(['keepAliveEnabled'], (result) => {
    if (result.keepAliveEnabled) {
      setKeepAliveEnabled(true);
    }
  });
}

function loadStatusAlertState() {
  chrome.storage.sync.get(['statusAlertEnabled'], (result) => {
    if (result.statusAlertEnabled) {
      setStatusAlertEnabled(true);
    }
  });
}

function setKeepAliveEnabled(enabled) {
  keepAliveEnabled = enabled;
  chrome.storage.sync.set({ keepAliveEnabled: enabled });

  if (enabled) {
    startKeepAlive();
  } else {
    stopKeepAlive();
  }
}

function startKeepAlive() {
  if (!teamsTabId) return;

  chrome.scripting.executeScript({
    target: { tabId: teamsTabId },
    func: setupKeepAlive,
  }, (results) => {
    if (chrome.runtime.lastError) {
      console.error('Failed to inject keep-alive script:', chrome.runtime.lastError);
    }
  });
}

function stopKeepAlive() {
  if (keepAliveIntervalId) {
    clearInterval(keepAliveIntervalId);
    keepAliveIntervalId = null;
  }

  if (teamsTabId) {
    chrome.scripting.executeScript({
      target: { tabId: teamsTabId },
      func: stopKeepAliveInTab,
    });
  }
}

function setStatusAlertEnabled(enabled) {
  statusAlertEnabled = enabled;
  chrome.storage.sync.set({ statusAlertEnabled: enabled });

  if (enabled) {
    startStatusMonitoring();
  } else {
    stopStatusMonitoring();
  }
}

function startStatusMonitoring() {
  if (!teamsTabId) return;

  chrome.scripting.executeScript({
    target: { tabId: teamsTabId },
    func: setupStatusMonitoring,
  }, (results) => {
    if (chrome.runtime.lastError) {
      console.error('Failed to inject status monitoring script:', chrome.runtime.lastError);
    }
  });
}

function stopStatusMonitoring() {
  if (teamsTabId) {
    chrome.scripting.executeScript({
      target: { tabId: teamsTabId },
      func: stopStatusMonitoringInTab,
    });
  }
}

chrome.tabs.onActivated.addListener(() => {
  checkTeamsTab();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.url && tab.url.includes('teams.microsoft.com')) {
    if (changeInfo.status === 'complete') {
      monitorTeamsTab(tabId);
    }
  }
});

function findTeamsTab() {
  chrome.tabs.query({ url: '*://teams.microsoft.com/*' }, (tabs) => {
    if (tabs.length > 0) {
      monitorTeamsTab(tabs[0].id);
    }
  });
}

function checkTeamsTab() {
  if (!teamsTabId) {
    findTeamsTab();
    return;
  }

  chrome.tabs.get(teamsTabId, (tab) => {
    if (chrome.runtime.lastError || !tab) {
      findTeamsTab();
    }
  });
}

function monitorTeamsTab(tabId) {
  teamsTabId = tabId;

  chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: setupMonitoring,
  }, (results) => {
    if (chrome.runtime.lastError) {
      console.error('Failed to inject script:', chrome.runtime.lastError);
    }
  });
}

function setupMonitoring() {
  if (window.teamsMonitorInstalled) return;
  window.teamsMonitorInstalled = true;

  console.log('Teams DOM monitor installed');

  function checkUnread() {
    let count = 0;

    const titleBadge = document.querySelector('[data-tid*="unread"]') ||
                       document.querySelector('[title*="unread"]') ||
                       document.querySelector('.ts-unread-badge');

    const bellIcon = document.querySelector('[data-icon-name="Bell"]') ||
                     document.querySelector('button[aria-label*="notification"]') ||
                     document.querySelector('button[aria-label*="Notification"]');

    if (bellIcon) {
      const badge = bellIcon.querySelector('[class*="badge"], [class*="counter"]');
      if (badge && badge.textContent) {
        const num = parseInt(badge.textContent.trim());
        if (!isNaN(num)) {
          count = num;
        }
      }
    }

    const unreadChats = document.querySelectorAll('[data-tid*="unread"], [aria-label*="unread"], [class*="unread"]');
    count = Math.max(count, unreadChats.length);

    const pageTitle = document.title;
    const parenMatch = pageTitle.match(/\((\d+)\)/);
    if (parenMatch) {
      count = Math.max(count, parseInt(parenMatch[1]));
    }

    return count;
  }

  let lastCount = -1;

  function poll() {
    const currentCount = checkUnread();

    if (currentCount !== lastCount) {
      const event = {
        type: currentCount > lastCount ? 'new_message' : 'message_read',
        count: currentCount,
        previousCount: lastCount,
        title: 'Microsoft Teams',
        message: currentCount > 0 ? `${currentCount} unread message${currentCount > 1 ? 's' : ''}` : 'No unread messages',
        timestamp: Date.now()
      };

      sendToServer(event);
      console.log('Teams count changed:', lastCount, '→', currentCount);

      lastCount = currentCount;
    }

    setTimeout(poll, 2000);
  }

  function sendToServer(event) {
    fetch('http://localhost:9876/notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event)
    }).catch(err => console.error('Server error:', err));
  }

  poll();
}

function setupKeepAlive() {
  if (window.teamsKeepAliveInstalled) return;
  window.teamsKeepAliveInstalled = true;

  console.log('Teams keep-alive installed');

  let keepAliveTimeoutId = null;

  function getRandomInterval() {
    // More aggressive: 10-30 seconds (was 15-45)
    return Math.floor(Math.random() * (30000 - 10000 + 1)) + 10000;
  }

  function performKeepAliveAction() {
    const actions = ['scroll', 'hover', 'mousemove', 'keypress', 'click'];
    const actionType = actions[Math.floor(Math.random() * actions.length)];

    if (actionType === 'scroll') {
      window.scrollBy(0, 1);
      setTimeout(() => {
        window.scrollBy(0, -1);
      }, 100);
      console.log('Keep-alive: scroll action');
    } else if (actionType === 'hover') {
      const safeElement = document.querySelector('[data-tid*="app-bar"]') ||
                         document.querySelector('header') ||
                         document.body;
      if (safeElement) {
        safeElement.dispatchEvent(new MouseEvent('mouseenter', {
          bubbles: true,
          cancelable: true
        }));
        console.log('Keep-alive: hover action');
      }
    } else if (actionType === 'mousemove') {
      // Simulate tiny mouse movement
      document.dispatchEvent(new MouseEvent('mousemove', {
        bubbles: true,
        cancelable: true,
        clientX: Math.floor(Math.random() * 10),
        clientY: Math.floor(Math.random() * 10)
      }));
      console.log('Keep-alive: mousemove action');
    } else if (actionType === 'keypress') {
      // Simulate a non-visible key press (Shift key)
      document.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Shift',
        code: 'ShiftLeft',
        bubbles: true,
        cancelable: true
      }));
      setTimeout(() => {
        document.dispatchEvent(new KeyboardEvent('keyup', {
          key: 'Shift',
          code: 'ShiftLeft',
          bubbles: true,
          cancelable: true
        }));
      }, 50);
      console.log('Keep-alive: keypress action');
    } else if (actionType === 'click') {
      // Simulate a click on a safe, non-interactive element
      const safeElement = document.querySelector('[data-tid*="app-bar"]') ||
                         document.querySelector('header');
      if (safeElement) {
        const rect = safeElement.getBoundingClientRect();
        safeElement.dispatchEvent(new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          clientX: rect.left + 5,
          clientY: rect.top + 5
        }));
        console.log('Keep-alive: click action');
      }
    }

    keepAliveTimeoutId = setTimeout(performKeepAliveAction, getRandomInterval());
  }

  performKeepAliveAction();

  window.stopKeepAlive = function() {
    if (keepAliveTimeoutId) {
      clearTimeout(keepAliveTimeoutId);
      keepAliveTimeoutId = null;
      console.log('Keep-alive stopped');
    }
  };
}

function stopKeepAliveInTab() {
  if (window.stopKeepAlive) {
    window.stopKeepAlive();
  }
}

function setupStatusMonitoring() {
  if (window.teamsStatusMonitorInstalled) return;
  window.teamsStatusMonitorInstalled = true;

  console.log('Teams status monitor installed');

  let lastStatus = '';

  function checkTeamsStatus() {
    console.log('Checking Teams status...');

    let status = 'unknown';

    // Check avatar element first (most reliable)
    const avatarElement = document.querySelector('[data-tid*="me-avatar"], [class*="avatar"], [class*="profile"]');
    if (avatarElement) {
      const avatarText = (avatarElement.textContent || avatarElement.getAttribute('aria-label') || '').toLowerCase();
      console.log('Avatar element found with text:', avatarText);
      if (avatarText.includes('available') || avatarText.includes('online')) {
        status = 'available';
      } else if (avatarText.includes('away') || avatarText.includes('offline')) {
        status = 'away';
      } else if (avatarText.includes('busy') || avatarText.includes('in a call') || avatarText.includes('in a meeting')) {
        status = 'busy';
      } else if (avatarText.includes('do not disturb') || avatarText.includes('dnd')) {
        status = 'dnd';
      }
    }

    // Only check other selectors if avatar didn't give us a clear answer
    if (status === 'unknown') {
      const statusSelectors = [
        '[data-tid*="presence-available"]',
        '[data-tid*="presence-away"]',
        '[data-tid*="presence-busy"]',
        '[data-tid*="presence-dnd"]',
        '[data-tid*="status"]',
        '[aria-label*="Available"]',
        '[aria-label*="Away"]',
        '[aria-label*="Busy"]',
        '[title*="Available"]',
        '[title*="Away"]',
        '[title*="Busy"]'
      ];

      for (const selector of statusSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          const text = (element.textContent || element.getAttribute('aria-label') || element.getAttribute('title') || '').toLowerCase();
          console.log('Found status element:', selector, 'with text:', text);
          if (text.includes('available') || text.includes('online')) {
            status = 'available';
            break;
          } else if (text.includes('away') || text.includes('offline')) {
            status = 'away';
            break;
          } else if (text.includes('busy') || text.includes('in a call') || text.includes('in a meeting')) {
            status = 'busy';
            break;
          } else if (text.includes('do not disturb') || text.includes('dnd')) {
            status = 'dnd';
            break;
          }
        }
      }
    }

    console.log('Current detected status:', status, ', Last status:', lastStatus);

    if (status !== 'unknown' && status !== lastStatus) {
      console.log('Teams status changed:', lastStatus, '→', status);

      if (status !== 'available') {
        const event = {
          type: 'status_away',
          count: 0,
          title: 'Teams Status',
          message: `You are now appearing as ${status.charAt(0).toUpperCase() + status.slice(1)}`,
          timestamp: Date.now()
        };

        sendStatusAlert(event);
      }

      lastStatus = status;
    }
  }

  function sendStatusAlert(event) {
    console.log('Sending status alert:', event);
    fetch('http://localhost:9876/notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event)
    }).catch(err => console.error('Server error:', err));
  }

  checkTeamsStatus();
  setInterval(checkTeamsStatus, 5000);
}

function stopStatusMonitoringInTab() {
  if (window.teamsStatusMonitorInstalled) {
    window.teamsStatusMonitorInstalled = false;
    console.log('Status monitoring stopped');
  }
}
