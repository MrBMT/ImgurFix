const PROXY_BASE = 'https://external-content.duckduckgo.com/iu/?u=';
const EXTENSIONS = ['.png', '.gif', '.webp', '.jpg', '.jpeg'];
const BARE_IMGUR = /^https?:\/\/(www\.)?imgur\.com\/([a-zA-Z0-9]+)$/;
const IMGUR_PATTERN = /^https?:\/\/(\w+\.)?imgur\.com\/.*/;
const IMGUR_SKIP = /^https?:\/\/(www\.)?imgur\.com(\/?(#.*)?$|\/a\/|\/gallery\/)/;
const IMGUR_MP4 = /\.mp4(\?.*)?$/i;
const BADGE_COLOR = '#4CAF50';

const cache = new Map();

// webRequest redirect
browser.webRequest.onBeforeRequest.addListener(
    (details) => {
        if (IMGUR_SKIP.test(details.url)) return;
        if (IMGUR_MP4.test(details.url)) return;
        if (IMGUR_PATTERN.test(details.url)) {
            return { redirectUrl: PROXY_BASE + encodeURIComponent(details.url) };
        }
    },
    { urls: ["*://*.imgur.com/*"] },
    ["blocking"]
);

// bare imgur URL resolution
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

browser.webNavigation.onBeforeNavigate.addListener(async ({ frameId, url, tabId }) => {
    if (frameId !== 0) return;
    const match = BARE_IMGUR.exec(url);
    if (!match) return;

    const resolved = await resolve(match[2]);
    if (resolved) browser.tabs.update(tabId, { url: resolved });
}, { url: [{ hostSuffix: 'imgur.com' }] });

// badge & storage messaging
let pendingIncrement = 0;
let flushScheduled = false;

function flushIncrement() {
    if (pendingIncrement === 0) return;
    const amount = pendingIncrement;
    pendingIncrement = 0;
    flushScheduled = false;
    browser.storage.local.get('totalProxied').then(({ totalProxied }) => {
        browser.storage.local.set({ totalProxied: (totalProxied || 0) + amount });
    });
}

browser.runtime.onMessage.addListener((message, sender) => {
    if (message.type === 'updateBadge' && sender.tab) {
        browser.storage.local.get('badgeEnabled').then(({ badgeEnabled }) => {
            const text = badgeEnabled !== false ? message.count.toString() : '';
            browser.browserAction.setBadgeText({ text, tabId: sender.tab.id });
            browser.browserAction.setBadgeBackgroundColor({ color: BADGE_COLOR, tabId: sender.tab.id });
        });
    } else if (message.type === 'incrementTotal') {
        pendingIncrement += message.amount;
        if (!flushScheduled) {
            flushScheduled = true;
            setTimeout(flushIncrement, 100);
        }
    } else if (message.type === 'setBadgeEnabled') {
        if (!message.enabled) {
            browser.tabs.query({}).then((tabs) => {
                tabs.forEach(tab => browser.browserAction.setBadgeText({ text: '', tabId: tab.id }));
            });
        } else {
            browser.tabs.query({}).then((tabs) => {
                tabs.forEach(tab => {
                    browser.tabs.sendMessage(tab.id, { type: 'getBadgeCount' }).catch(() => {});
                });
            });
        }
    }
});