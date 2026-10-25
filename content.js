(function () {
    'use strict';

    const CHECK_ICON = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
    const DOWNLOAD_ICON = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>';

    const BUTTON_STYLE =
        'position: fixed !important;' +
        'bottom: 30px !important;' +
        'right: 30px !important;' +
        'z-index: 2147483647 !important;' +
        'background-color: #000000 !important;' +
        'border: 2px solid #ffffff !important;' +
        'width: 60px !important;' +
        'height: 60px !important;' +
        'border-radius: 50% !important;' +
        'display: flex !important;' +
        'align-items: center !important;' +
        'justify-content: center !important;' +
        'cursor: pointer !important;' +
        'box-shadow: 0 4px 15px rgba(0,0,0,0.8) !important;' +
        'transition: all 0.2s ease-in-out !important;' +
        'padding: 0 !important;' +
        'margin: 0 !important;';

    const token = (() => {
        const a = new Uint32Array(4);
        crypto.getRandomValues(a);
        return Array.from(a).map((n) => n.toString(16)).join('-');
    })();

    let currentPdfUrl = null;
    let currentFilename = null;

    const showDownloadButton = (url, filename) => {
        if (url) currentPdfUrl = url;
        if (filename) currentFilename = filename;

        const body = document.body;
        if (!body) return;

        let btn = document.getElementById('stealth-dl-btn');

        if (!btn) {
            btn = document.createElement('button');
            btn.id = 'stealth-dl-btn';
            btn.title = 'Download Course PDF';
            btn.style.cssText = BUTTON_STYLE;

            btn.onmouseover = () => {
                btn.style.backgroundColor = '#333333';
                btn.style.transform = 'scale(1.1)';
            };
            btn.onmouseout = () => {
                btn.style.backgroundColor = '#000000';
                btn.style.transform = 'scale(1)';
            };
            body.appendChild(btn);
        }

        btn.innerHTML = DOWNLOAD_ICON;
        btn.style.display = 'flex';

        btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Notify inject.js to extract PDF bytes directly from memory or trigger viewer download
            window.postMessage({ type: 'REQUEST_PDF_DOWNLOAD', k: token }, '*');

            // Fallback: If URL is available, also request background download
            if (currentPdfUrl) {
                chrome.runtime.sendMessage({
                    type: 'DOWNLOAD',
                    url: currentPdfUrl,
                    filename: currentFilename
                }, () => {
                    if (chrome.runtime.lastError) {}
                });
            }

            btn.innerHTML = CHECK_ICON;
            btn.style.borderColor = '#4ade80';
            setTimeout(() => {
                btn.innerHTML = DOWNLOAD_ICON;
                btn.style.borderColor = '#ffffff';
            }, 2000);
        };
    };

    const scanDOMForPDFs = () => {
        // 1. Detect ngx-extended-pdf-viewer or any embedded PDF viewer
        const viewerElements = document.querySelectorAll(
            'ngx-extended-pdf-viewer, pdf-viewer, #viewerContainer, .pdfViewer, #outerContainer'
        );
        if (viewerElements.length > 0) {
            showDownloadButton();

            // Unhide native download button in toolbar if hidden
            document.querySelectorAll('#download, #secondaryDownload, button.download').forEach(el => {
                try {
                    el.style.setProperty('display', 'inline-flex', 'important');
                    el.style.setProperty('visibility', 'visible', 'important');
                    el.classList.remove('hidden');
                    el.removeAttribute('hidden');
                } catch (e) {}
            });
        }

        // 2. Check for elements with ng-reflect-src containing pdf
        document.querySelectorAll('[ng-reflect-src]').forEach(el => {
            try {
                const src = el.getAttribute('ng-reflect-src');
                if (src && (src.includes('.pdf') || src.includes('storage.googleapis.com'))) {
                    showDownloadButton(src);
                }
            } catch (e) {}
        });

        // 3. Check iframes
        document.querySelectorAll('iframe').forEach(el => {
            try {
                if (el.src && (el.src.includes('.pdf') || el.src.includes('storage.googleapis.com'))) {
                    showDownloadButton(el.src);
                }
            } catch (e) {}
        });

        // 4. Check embeds and objects
        document.querySelectorAll('embed, object').forEach(el => {
            try {
                const src = el.src || el.data;
                if (src && (src.includes('.pdf') || src.includes('storage.googleapis.com'))) {
                    showDownloadButton(src);
                }
            } catch (e) {}
        });

        // 5. Check links
        document.querySelectorAll('a[href*=".pdf"], a[href*="storage.googleapis.com"]').forEach(el => {
            try {
                if (el.href) showDownloadButton(el.href);
            } catch (e) {}
        });
    };

    const injectScript = () => {
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('inject.js');
        script.setAttribute('data-ext-token', token);
        script.onload = function () {
            this.remove();
        };
        (document.head || document.documentElement).appendChild(script);
    };

    injectScript();

    window.addEventListener('message', function (e) {
        if (e.source !== window || !e.data) return;

        if (e.data.type === 'PDF_READY' && e.data.k === token) {
            showDownloadButton(e.data.url, e.data.filename);
        }

        if (e.data.type === 'PERFORM_EXTENSION_DOWNLOAD' && e.data.k === token && e.data.url) {
            chrome.runtime.sendMessage({
                type: 'DOWNLOAD',
                url: e.data.url,
                filename: e.data.filename
            }, () => {
                if (chrome.runtime.lastError) {}
            });
        }
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            scanDOMForPDFs();
        });
    } else {
        scanDOMForPDFs();
    }

    setInterval(scanDOMForPDFs, 1000);

    const observer = new MutationObserver(() => {
        scanDOMForPDFs();
    });
    observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['src', 'data', 'href', 'ng-reflect-src', 'class']
    });

})();
