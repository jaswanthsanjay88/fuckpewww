(function () {
    'use strict';

    let isDownloading = false;
    window.__PEWWW_HAS_PDF__ = false;
    window.__PEWWW_CURRENT_PDF_BLOB__ = null;
    window.__PEWWW_CURRENT_PDF_URL__ = null;
    window.__PEWWW_PDF_DOC__ = null;

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
            '.unit-title',
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
        return 'Parul-Course-Material.pdf';
    }

    function markPdfReady(url, blob, doc) {
        window.__PEWWW_HAS_PDF__ = true;
        if (url && !window.__PEWWW_CURRENT_PDF_URL__) {
            window.__PEWWW_CURRENT_PDF_URL__ = url;
        }
        if (blob && !window.__PEWWW_CURRENT_PDF_BLOB__) {
            window.__PEWWW_CURRENT_PDF_BLOB__ = blob;
        }
        if (doc && !window.__PEWWW_PDF_DOC__) {
            window.__PEWWW_PDF_DOC__ = doc;
        }
        try {
            window.postMessage({
                type: '__PEWWW_CHECK_STATUS_RES__',
                isLoaded: true,
                url: window.__PEWWW_CURRENT_PDF_URL__
            }, '*');
        } catch (e) {}
    }

    // 1. Hook window.fetch to capture PDF stream, blob, or signed URLs
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
        let urlStr = '';
        if (args[0]) {
            if (typeof args[0] === 'string') urlStr = args[0];
            else if (typeof args[0] === 'object' && args[0].url) urlStr = args[0].url;
            else if (args[0].toString) urlStr = args[0].toString();
        }

        const lower = urlStr.toLowerCase();
        if (lower.includes('signed-url') && lower.includes('url=')) {
            try {
                const parsed = new URL(urlStr, window.location.href);
                const target = parsed.searchParams.get('url');
                if (target) {
                    markPdfReady(decodeURIComponent(target));
                }
            } catch (e) {}
        } else if (lower.includes('.pdf') || (lower.includes('storage.googleapis.com') && lower.includes('parul'))) {
            markPdfReady(urlStr);
        }

        const response = await originalFetch.apply(this, args);

        try {
            const contentType = response.headers && response.headers.get('content-type');
            if (contentType && contentType.toLowerCase().includes('application/pdf')) {
                const clone = response.clone();
                clone.blob().then((blob) => {
                    markPdfReady(urlStr, blob);
                }).catch(() => {});
            } else if (urlStr && (lower.includes('/signed-url') || lower.includes('api/assets'))) {
                const clone = response.clone();
                clone.json().then((data) => {
                    if (!data) return;
                    if (typeof data.signedUrl === 'string') {
                        markPdfReady(data.signedUrl);
                    } else if (typeof data.url === 'string') {
                        markPdfReady(data.url);
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
                                    if (finalUrl) markPdfReady(finalUrl);
                                } else if (decrypted.includes('http')) {
                                    markPdfReady(decrypted.trim());
                                }
                            }
                        } catch (e) {}
                    }
                }).catch(() => {});
            }
        } catch (e) {}

        return response;
    };

    // 2. Hook XMLHttpRequest
    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url) {
        if (url) {
            const urlStr = typeof url === 'string' ? url : (url.href || url.toString());
            const lower = urlStr.toLowerCase();
            if (lower.includes('.pdf') || (lower.includes('storage.googleapis.com') && lower.includes('parul'))) {
                markPdfReady(urlStr);
            }
            this.addEventListener('load', function () {
                try {
                    const ct = this.getResponseHeader && this.getResponseHeader('content-type');
                    if (ct && ct.toLowerCase().includes('application/pdf')) {
                        if (this.response instanceof Blob) {
                            markPdfReady(urlStr, this.response);
                        } else if (this.response instanceof ArrayBuffer) {
                            markPdfReady(urlStr, new Blob([this.response], { type: 'application/pdf' }));
                        }
                    }
                } catch (e) {}
            });
        }
        return originalOpen.apply(this, arguments);
    };

    // 3. Hook PDF.js library getDocument
    function hookPdfJs(lib) {
        if (!lib || lib.__pewww_hooked) return;
        lib.__pewww_hooked = true;
        const origGetDoc = lib.getDocument;
        lib.getDocument = function (param) {
            if (typeof param === 'string') {
                markPdfReady(param);
            } else if (param && param.url) {
                markPdfReady(param.url);
            } else if (param && param.data) {
                try {
                    const blob = new Blob([param.data], { type: 'application/pdf' });
                    markPdfReady(null, blob);
                } catch (e) {}
            }
            const task = origGetDoc.apply(this, arguments);
            try {
                task.promise.then((doc) => {
                    markPdfReady(null, null, doc);
                }).catch(() => {});
            } catch (e) {}
            return task;
        };
    }

    if (window.pdfjsLib) hookPdfJs(window.pdfjsLib);
    let _pdfjsVal = window.pdfjsLib;
    try {
        Object.defineProperty(window, 'pdfjsLib', {
            configurable: true,
            enumerable: true,
            get() { return _pdfjsVal; },
            set(v) {
                _pdfjsVal = v;
                hookPdfJs(v);
            }
        });
    } catch (e) {}

    // 4. Hook PDFViewerApplication (for ngx-extended-pdf-viewer)
    function hookViewerApp() {
        const app = window.PDFViewerApplication;
        if (!app) return false;

        if (app.eventBus && !app._pewww_bus_hooked) {
            app._pewww_bus_hooked = true;
            app.eventBus.on('documentloaded', () => markPdfReady(app.url || app.baseUrl, null, app.pdfDocument));
            app.eventBus.on('pagesloaded', () => markPdfReady(app.url || app.baseUrl, null, app.pdfDocument));
        }

        if (app.pdfDocument || (app.pagesCount && app.pagesCount > 0)) {
            markPdfReady(app.url || app.baseUrl, null, app.pdfDocument);
            return true;
        }

        return false;
    }

    document.addEventListener('webviewerloaded', () => {
        hookViewerApp();
        if (window.PDFViewerApplication && window.PDFViewerApplication.initializedPromise) {
            window.PDFViewerApplication.initializedPromise.then(() => hookViewerApp()).catch(() => {});
        }
    });

    setInterval(() => {
        hookViewerApp();

        // Check ng2-pdf-viewer or custom Angular component
        const viewerEl = document.querySelector('pdf-viewer, ngx-extended-pdf-viewer, .ng2-pdf-viewer-container');
        if (viewerEl) {
            const reflectSrc = viewerEl.getAttribute('ng-reflect-src') || viewerEl.getAttribute('src');
            if (reflectSrc) {
                markPdfReady(reflectSrc);
            } else {
                markPdfReady();
            }

            if (window.ng && typeof window.ng.getComponent === 'function') {
                try {
                    const comp = window.ng.getComponent(viewerEl);
                    if (comp) {
                        const pdf = comp._pdf || comp.pdf || comp.pdfDocument;
                        if (pdf) markPdfReady(comp.src || comp.pdfSrc, null, pdf);
                        else if (comp.src || comp.pdfSrc) markPdfReady(comp.src || comp.pdfSrc);
                    }
                } catch (e) {}
            }
        }
    }, 800);

    function triggerBlobDownload(blob, filename) {
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename || getPageFallbackTitle();
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            a.remove();
            URL.revokeObjectURL(blobUrl);
        }, 15000);
        window.postMessage({ type: '__PEWWW_DOWNLOAD_SUCCESS__' }, '*');
    }

    async function runDownload() {
        if (isDownloading) return false;
        isDownloading = true;
        setTimeout(() => { isDownloading = false; }, 2000);

        const filename = getPageFallbackTitle();

        // Strategy 1: Captured PDF Blob in memory
        if (window.__PEWWW_CURRENT_PDF_BLOB__) {
            triggerBlobDownload(window.__PEWWW_CURRENT_PDF_BLOB__, filename);
            return true;
        }

        // Strategy 2: PDFDocumentProxy from pdfjsLib or ng2-pdf-viewer
        const activeDoc = window.__PEWWW_PDF_DOC__ || (window.PDFViewerApplication && window.PDFViewerApplication.pdfDocument);
        if (activeDoc && typeof activeDoc.getData === 'function') {
            try {
                const data = await activeDoc.getData();
                if (data && data.length > 0) {
                    const blob = new Blob([data], { type: 'application/pdf' });
                    triggerBlobDownload(blob, filename);
                    return true;
                }
            } catch (e) {}
        }

        // Strategy 3: Angular Component inspection for ng2-pdf-viewer
        const viewerEl = document.querySelector('pdf-viewer, ngx-extended-pdf-viewer');
        if (viewerEl && window.ng && typeof window.ng.getComponent === 'function') {
            try {
                const comp = window.ng.getComponent(viewerEl);
                const pdf = comp && (comp._pdf || comp.pdf || comp.pdfDocument);
                if (pdf && typeof pdf.getData === 'function') {
                    const data = await pdf.getData();
                    if (data && data.length > 0) {
                        const blob = new Blob([data], { type: 'application/pdf' });
                        triggerBlobDownload(blob, filename);
                        return true;
                    }
                }
            } catch (e) {}
        }

        // Strategy 4: Native PDFViewerApplication downloadOrSave / download
        const app = window.PDFViewerApplication;
        if (app) {
            try {
                if (typeof app.downloadOrSave === 'function') {
                    app.downloadOrSave();
                    window.postMessage({ type: '__PEWWW_DOWNLOAD_SUCCESS__' }, '*');
                    return true;
                }
                if (typeof app.download === 'function') {
                    app.download();
                    window.postMessage({ type: '__PEWWW_DOWNLOAD_SUCCESS__' }, '*');
                    return true;
                }
            } catch (e) {}
        }

        // Strategy 5: Download captured URL via link
        if (window.__PEWWW_CURRENT_PDF_URL__) {
            try {
                const a = document.createElement('a');
                a.href = window.__PEWWW_CURRENT_PDF_URL__;
                a.download = filename;
                a.target = '_blank';
                document.body.appendChild(a);
                a.click();
                setTimeout(() => a.remove(), 2000);
                window.postMessage({ type: '__PEWWW_DOWNLOAD_SUCCESS__' }, '*');
                return true;
            } catch (e) {}
        }

        // Strategy 6: Native toolbar button click
        const btn = document.querySelector('#download, #secondaryDownload');
        if (btn) {
            btn.click();
            window.postMessage({ type: '__PEWWW_DOWNLOAD_SUCCESS__' }, '*');
            return true;
        }

        return false;
    }

    // Listen for download triggers
    window.addEventListener('message', function (e) {
        if (!e.data) return;
        if (e.data.type === '__PEWWW_EXECUTE_DOWNLOAD__') {
            runDownload();
        } else if (e.data.type === '__PEWWW_CHECK_STATUS_REQ__') {
            window.postMessage({
                type: '__PEWWW_CHECK_STATUS_RES__',
                isLoaded: window.__PEWWW_HAS_PDF__ || !!window.PDFViewerApplication || !!document.querySelector('pdf-viewer, ngx-extended-pdf-viewer, .ng2-pdf-viewer-container')
            }, '*');
        }
    });

    try {
        window.postMessage({
            type: '__PEWWW_CHECK_STATUS_RES__',
            isLoaded: !!window.PDFViewerApplication || !!document.querySelector('pdf-viewer, ngx-extended-pdf-viewer, .ng2-pdf-viewer-container')
        }, '*');
    } catch (e) {}
})();
