(function() {
    'use strict';

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

    let currentPdfUrl = '';
    let currentPdfFilename = '';

    function getCleanFilename(rawName) {
        if (!rawName || typeof rawName !== 'string') return '';
        let clean = rawName.split('/').pop().split('?')[0].replace(/[\\/:*?"<>|]/g, '-').trim();
        if (clean && !clean.toLowerCase().endsWith('.pdf')) {
            clean += '.pdf';
        }
        return clean;
    }

    function getPageFallbackTitle() {
        const selectors = [
            '.course-title',
            '.chapter-title',
            '.subject-name',
            '.breadcrumb-item.active',
            '.pdf-title',
            'h1', 'h2', 'h3',
            '.page-title'
        ];
        for (let i = 0; i < selectors.length; i++) {
            const el = document.querySelector(selectors[i]);
            if (el && el.innerText && el.innerText.trim().length > 1) {
                return getCleanFilename(el.innerText.trim());
            }
        }
        if (document.title && document.title.trim().length > 1) {
            return getCleanFilename(document.title.trim());
        }
        return 'parul-course-material.pdf';
    }

    function notifyPdfReady(info) {
        if (info.url && !currentPdfUrl) {
            currentPdfUrl = info.url;
        }
        if (info.filename && !currentPdfFilename) {
            currentPdfFilename = info.filename;
        }
        if (!currentPdfFilename && currentPdfUrl) {
            currentPdfFilename = getCleanFilename(currentPdfUrl);
        }
        if (!currentPdfFilename) {
            currentPdfFilename = getPageFallbackTitle();
        }

        window.postMessage({
            type: 'PDF_READY',
            k: __t,
            url: currentPdfUrl,
            filename: currentPdfFilename
        }, '*');
    }

    function inspectUrl(rawUrl) {
        if (!rawUrl || typeof rawUrl !== 'string') return;
        const lower = rawUrl.toLowerCase();

        if (lower.includes('signed-url') && lower.includes('url=')) {
            try {
                const parsed = new URL(rawUrl, window.location.href);
                const target = parsed.searchParams.get('url');
                if (target) {
                    const decoded = decodeURIComponent(target);
                    notifyPdfReady({
                        url: decoded,
                        filename: getCleanFilename(decoded)
                    });
                    return;
                }
            } catch (e) {}
        }

        const isStorageDomain = lower.includes('storage.googleapis.com') || lower.includes('amazonaws.com');
        const hasPdf = lower.includes('.pdf') || lower.includes('pdf');
        const isNotScript = !lower.endsWith('.js') && !lower.endsWith('.css') && !lower.endsWith('.html');

        if ((isStorageDomain || hasPdf) && isNotScript) {
            notifyPdfReady({
                url: rawUrl,
                filename: getCleanFilename(rawUrl)
            });
        }
    }

    // Intercept window.fetch
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        if (args[0]) {
            let urlStr = '';
            if (typeof args[0] === 'string') {
                urlStr = args[0];
            } else if (typeof args[0] === 'object' && args[0].url) {
                urlStr = args[0].url;
            } else if (args[0].toString) {
                urlStr = args[0].toString();
            }

            inspectUrl(urlStr);

            const response = await originalFetch.apply(this, args);

            if (urlStr && (urlStr.includes('/signed-url') || urlStr.includes('api/assets'))) {
                try {
                    const clone = response.clone();
                    clone.json().then(data => {
                        if (!data) return;
                        if (typeof data.signedUrl === 'string') {
                            notifyPdfReady({ url: data.signedUrl, filename: getCleanFilename(data.signedUrl) });
                        } else if (typeof data.url === 'string') {
                            notifyPdfReady({ url: data.url, filename: getCleanFilename(data.url) });
                        } else if (typeof data.response === 'string' && window.CryptoJS) {
                            try {
                                const secretKey = "sdm8Yy6OCCH5Du/IxBC3yJ17gkEECG3VEUwnQgGFyNKs0OyvdCtNi2AxTzUcQE94";
                                const bytes = window.CryptoJS.AES.decrypt(data.response, secretKey);
                                let decrypted = bytes.toString(window.CryptoJS.enc.Utf8);
                                if (decrypted) {
                                    if (decrypted.startsWith('"') && decrypted.endsWith('"')) {
                                        decrypted = decrypted.slice(1, -1);
                                    }
                                    if (decrypted.startsWith('{')) {
                                        const parsed = JSON.parse(decrypted);
                                        const finalUrl = parsed.signedUrl || parsed.url || parsed.link;
                                        if (finalUrl) notifyPdfReady({ url: finalUrl, filename: getCleanFilename(finalUrl) });
                                    } else if (decrypted.includes('http')) {
                                        notifyPdfReady({ url: decrypted.trim(), filename: getCleanFilename(decrypted.trim()) });
                                    }
                                }
                            } catch (e) {}
                        }
                    }).catch(() => {});
                } catch (e) {}
            }

            return response;
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
            inspectUrl(urlStr);
        }
        return originalOpen.apply(this, arguments);
    };

    // Hook ngx-extended-pdf-viewer / PDF.js
    function checkPdfViewerApp() {
        const app = window.PDFViewerApplication;
        if (!app) return false;

        if (app.eventBus && !app._fcukHooked) {
            app._fcukHooked = true;
            app.eventBus.on('documentloaded', onDocumentLoaded);
            app.eventBus.on('pagesloaded', onDocumentLoaded);
        }

        if (app.pdfDocument) {
            onDocumentLoaded();
            return true;
        }

        if (app.url || app.baseUrl) {
            const u = app.url || app.baseUrl;
            notifyPdfReady({ url: u, filename: getCleanFilename(u) });
            return true;
        }

        return false;
    }

    function onDocumentLoaded() {
        const app = window.PDFViewerApplication;
        if (!app) return;

        let filename = '';
        const url = app.url || app.baseUrl || '';

        if (app.pdfDocument && app.pdfDocument.metadata) {
            try {
                const info = app.pdfDocument.metadata.info;
                if (info && info.Title) {
                    filename = getCleanFilename(info.Title);
                }
            } catch (e) {}
        }

        if (!filename && url) {
            filename = getCleanFilename(url);
        }
        if (!filename) {
            filename = getPageFallbackTitle();
        }

        notifyPdfReady({
            url: url,
            filename: filename
        });
    }

    document.addEventListener('webviewerloaded', () => {
        if (window.PDFViewerApplication) {
            if (window.PDFViewerApplication.initializedPromise) {
                window.PDFViewerApplication.initializedPromise.then(() => {
                    checkPdfViewerApp();
                }).catch(() => {});
            } else {
                checkPdfViewerApp();
            }
        }
    });

    // Check periodically for PDFViewerApplication or DOM viewer
    setInterval(() => {
        checkPdfViewerApp();

        const ngxViewer = document.querySelector('ngx-extended-pdf-viewer, pdf-viewer, #viewerContainer, .pdfViewer');
        if (ngxViewer) {
            const reflectSrc = ngxViewer.getAttribute('ng-reflect-src') || ngxViewer.getAttribute('src');
            if (reflectSrc) {
                inspectUrl(reflectSrc);
            }
            notifyPdfReady({
                url: currentPdfUrl,
                filename: currentPdfFilename || getPageFallbackTitle()
            });
        }
    }, 1000);

    // Handle download request triggered by floating button click
    window.addEventListener('message', async (e) => {
        if (e.source !== window || !e.data) return;
        if (e.data.type === 'REQUEST_PDF_DOWNLOAD' && e.data.k === __t) {
            const app = window.PDFViewerApplication;
            const targetFilename = currentPdfFilename || getPageFallbackTitle();

            // 1. Direct raw memory extraction from PDFViewerApplication.pdfDocument.getData()
            if (app && app.pdfDocument && typeof app.pdfDocument.getData === 'function') {
                try {
                    const data = await app.pdfDocument.getData();
                    if (data && data.length > 0) {
                        const blob = new Blob([data], { type: 'application/pdf' });
                        const blobUrl = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = blobUrl;
                        a.download = targetFilename;
                        document.body.appendChild(a);
                        a.click();
                        setTimeout(() => {
                            a.remove();
                            URL.revokeObjectURL(blobUrl);
                        }, 15000);
                        return;
                    }
                } catch (err) {}
            }

            // 2. Built-in viewer download action
            if (app && typeof app.download === 'function') {
                try {
                    app.download();
                    return;
                } catch (err) {}
            }
            if (app && typeof app.downloadOrSave === 'function') {
                try {
                    app.downloadOrSave();
                    return;
                } catch (err) {}
            }

            // 3. Native download button click if present
            const nativeBtn = document.querySelector('#download, #secondaryDownload');
            if (nativeBtn) {
                try {
                    nativeBtn.click();
                    return;
                } catch (err) {}
            }

            // 4. Fallback to background script download using captured URL
            if (currentPdfUrl) {
                window.postMessage({
                    type: 'PERFORM_EXTENSION_DOWNLOAD',
                    k: __t,
                    url: currentPdfUrl,
                    filename: targetFilename
                }, '*');
            }
        }
    });
})();
