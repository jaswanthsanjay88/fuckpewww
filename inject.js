(function() {
    'use strict';

    // Get security token with a fallback in case document.currentScript is null
    let __t = '';
    if (document.currentScript) {
        __t = document.currentScript.getAttribute('data-ext-token') || '';
    } else {
        const scr = document.querySelector('script[data-ext-token]');
        if (scr) {
            __t = scr.getAttribute('data-ext-token') || '';
        }
    }

    if (!__t) return;

    // Helper to determine if a URL is a Google Cloud Storage or AWS S3 PDF file
    function isPdfUrl(url) {
        if (typeof url !== 'string') return false;
        const lower = url.toLowerCase();
        return (lower.includes('storage.googleapis.com') || lower.includes('amazonaws.com')) && 
               lower.includes('.pdf') && 
               !lower.includes('api.paruluniversity.ac.in');
    }

    // Intercept window.fetch
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        if (args[0]) {
            let url = '';
            if (typeof args[0] === 'string') {
                url = args[0];
            } else if (typeof args[0] === 'object' && args[0].url) {
                url = args[0].url;
            } else if (args[0].toString) {
                url = args[0].toString();
            }

            if (isPdfUrl(url)) {
                window.postMessage({ type: 'PDF_URL_FOUND', url: url, k: __t }, '*');
            }
        }
        return originalFetch.apply(this, args);
    };

    // Intercept XMLHttpRequest
    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
        if (url) {
            let urlStr = '';
            if (typeof url === 'string') {
                urlStr = url;
            } else if (url && url.href) {
                urlStr = url.href;
            } else {
                urlStr = url.toString();
            }

            if (isPdfUrl(urlStr)) {
                window.postMessage({ type: 'PDF_URL_FOUND', url: urlStr, k: __t }, '*');
            }
        }
        return originalOpen.apply(this, arguments);
    };
})();