document.addEventListener('DOMContentLoaded', () => {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        const currentTab = tabs[0];
        if (currentTab) {
            chrome.action.getBadgeText({tabId: currentTab.id}, (text) => {
                document.getElementById('currentCount').textContent = text || '0';
            });
        }
    });

    function updateTotalCount() {
        chrome.storage.local.get(['totalProxied'], (result) => {
            const count = result.totalProxied || 0;
            document.getElementById('totalCount').textContent = count.toLocaleString();
        });
    }

    updateTotalCount();

    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'updateBadge') {
            document.getElementById('currentCount').textContent = message.count;
        } else if (message.type === 'incrementTotal') {
            updateTotalCount();
        }
    });

    document.getElementById('resetStats').addEventListener('click', () => {
        chrome.storage.local.set({ totalProxied: 0 }, () => {
            document.getElementById('totalCount').textContent = '0';
        });
    });

    const badgeToggle = document.getElementById('badgeToggle');

    chrome.storage.local.get(['badgeEnabled'], (result) => {
        const enabled = result.badgeEnabled !== false;
        badgeToggle.checked = enabled;
    });

    badgeToggle.addEventListener('change', () => {
        const enabled = badgeToggle.checked;
        chrome.storage.local.set({ badgeEnabled: enabled });
        chrome.runtime.sendMessage({ type: 'setBadgeEnabled', enabled });
    });
});