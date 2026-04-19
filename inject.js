const __t = (document.currentScript && document.currentScript.getAttribute('data-ext-token')) || '';

// Listen for the specific Google Storage URL that the PDF viewer requests
const originalFetch = window.fetch;
window.fetch = async function(...args) {
    const url = args[0];
    if (typeof url === 'string' && url.includes('storage.googleapis.com/parul-local-important') && __t) {
        // Send the URL out to the extension
        window.postMessage({ type: 'PDF_URL_FOUND', url: url, k: __t }, '*');
    }
    return originalFetch.apply(this, args);
};

const originalOpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function(method, url) {
    if (typeof url === 'string' && url.includes('storage.googleapis.com/parul-local-important') && __t) {
        window.postMessage({ type: 'PDF_URL_FOUND', url: url, k: __t }, '*');
    }
    return originalOpen.apply(this, arguments);
};