const IMGUR = /^https?:\/\/(\w+\.)?imgur\.com\/.*/;
const PROXY_HOST = 'external-content.duckduckgo.com';
const processed = new WeakSet();
let pageCount = 0;

function increment(amount = 1) {
    pageCount += amount;
    browser.runtime.sendMessage({ type: 'updateBadge', count: pageCount });
    browser.runtime.sendMessage({ type: 'incrementTotal', amount });
}

function isProxiedImgur(src) {
    try {
        const url = new URL(src);
        if (url.hostname !== PROXY_HOST) return false;
        const original = url.searchParams.get('u');
        return original && IMGUR.test(original);
    } catch {}
    return false;
}

function checkRedirect() {
    if (window.location.hostname !== PROXY_HOST) return;
    const original = new URL(window.location.href).searchParams.get('u');
    if (original && IMGUR.test(original)) increment();
}

function trackImage(img) {
    if (processed.has(img)) return;
    processed.add(img);

    if (img.complete) {
        if (img.naturalWidth > 0) increment();
        return;
    }
    img.addEventListener('load', () => increment(), { once: true });
}

function processImages() {
    for (const img of document.querySelectorAll('img')) {
        if (processed.has(img)) continue;
        if (isProxiedImgur(img.src) || IMGUR.test(img.src)) trackImage(img);
    }
}

checkRedirect();

browser.runtime.onMessage.addListener((message) => {
    if (message.type === 'getBadgeCount' && pageCount > 0) {
        browser.runtime.sendMessage({ type: 'updateBadge', count: pageCount });
    }
});

if (window.location.hostname !== PROXY_HOST) {
    processImages();
    new MutationObserver(processImages).observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['src']
    });
}
