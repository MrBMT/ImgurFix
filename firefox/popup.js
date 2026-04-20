document.addEventListener('DOMContentLoaded', async () => {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];
    if (currentTab) {
        const text = await browser.browserAction.getBadgeText({ tabId: currentTab.id });
        document.getElementById('currentCount').textContent = text || '0';
    }

    async function updateTotalCount() {
        const { totalProxied } = await browser.storage.local.get('totalProxied');
        document.getElementById('totalCount').textContent = (totalProxied || 0).toLocaleString();
    }

    updateTotalCount();

    browser.runtime.onMessage.addListener((message) => {
        if (message.type === 'updateBadge') {
            document.getElementById('currentCount').textContent = message.count;
        } else if (message.type === 'incrementTotal') {
            updateTotalCount();
        }
    });

    document.getElementById('resetStats').addEventListener('click', async () => {
        await browser.storage.local.set({ totalProxied: 0 });
        document.getElementById('totalCount').textContent = '0';
    });

    const badgeToggle = document.getElementById('badgeToggle');

    const { badgeEnabled } = await browser.storage.local.get('badgeEnabled');
    badgeToggle.checked = badgeEnabled !== false;

    badgeToggle.addEventListener('change', () => {
        const enabled = badgeToggle.checked;
        browser.storage.local.set({ badgeEnabled: enabled });
        browser.runtime.sendMessage({ type: 'setBadgeEnabled', enabled });
    });
});
