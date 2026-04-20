const PROXY_BASE = 'https://external-content.duckduckgo.com/iu/?u=';
const EXTENSIONS = ['.png', '.gif', '.webp', '.jpg', '.jpeg'];
const BARE_IMGUR = /^https?:\/\/(www\.)?imgur\.com\/([a-zA-Z0-9]+)$/;
const BADGE_COLOR = '#4CAF50';

const cache = new Map();

async function resolve(id) {
    if (cache.has(id)) return cache.get(id);

    for (const ext of EXTENSIONS) {
        const url = `${PROXY_BASE}${encodeURIComponent(`https://i.imgur.com/${id}${ext}`)}`;
        try {
            if ((await fetch(url, { method: 'HEAD' })).ok) {
                cache.set(id, url);
                return url;
            }
        } catch {}
    }
    return null;
}

chrome.webNavigation.onBeforeNavigate.addListener(async ({ frameId, url, tabId }) => {
    if (frameId !== 0) return;
    const match = BARE_IMGUR.exec(url);
    if (!match) return;

    const resolved = await resolve(match[2]);
    if (resolved) chrome.tabs.update(tabId, { url: resolved });
}, { url: [{ hostSuffix: 'imgur.com' }] });

let pendingIncrement = 0;
let flushScheduled = false;

function flushIncrement() {
    if (pendingIncrement === 0) return;
    const amount = pendingIncrement;
    pendingIncrement = 0;
    flushScheduled = false;
    chrome.storage.local.get(['totalProxied'], ({ totalProxied }) => {
        chrome.storage.local.set({ totalProxied: (totalProxied || 0) + amount });
    });
}

chrome.runtime.onMessage.addListener((message, sender) => {
    if (message.type === 'updateBadge' && sender.tab) {
        chrome.storage.local.get(['badgeEnabled'], ({ badgeEnabled }) => {
            const text = badgeEnabled !== false ? message.count.toString() : '';
            chrome.action.setBadgeText({ text, tabId: sender.tab.id });
            chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR, tabId: sender.tab.id });
        });
    } else if (message.type === 'incrementTotal') {
        pendingIncrement += message.amount;
        if (!flushScheduled) {
            flushScheduled = true;
            setTimeout(flushIncrement, 100);
        }
    } else if (message.type === 'setBadgeEnabled') {
        if (!message.enabled) {
            chrome.tabs.query({}, (tabs) => {
                tabs.forEach(tab => chrome.action.setBadgeText({ text: '', tabId: tab.id }));
            });
        } else {
            chrome.tabs.query({}, (tabs) => {
                tabs.forEach(tab => {
                    chrome.tabs.sendMessage(tab.id, { type: 'getBadgeCount' }).catch(() => {});
                });
            });
        }
    }
});
