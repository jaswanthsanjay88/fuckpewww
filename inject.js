(function () {
    'use strict';

    let isDownloading = false;
    window.__PEWWW_HAS_PDF__ = false;
    window.__PEWWW_CURRENT_PDF_BLOB__ = null;
    window.__PEWWW_CURRENT_PDF_URL__ = null;
    window.__PEWWW_PDF_DOC__ = null;
    window.__PEWWW_PDF_NAME__ = null;

    function cleanPdfFilename(raw) {
        if (!raw || typeof raw !== 'string') return '';
        let str = raw;
        try { str = decodeURIComponent(decodeURIComponent(str)); } catch (e) {}

        let name = str.split('?')[0].split('/').pop();
        // Remove standard UUID prefix: 8e2a9301-e70f-42aa-81dd-200bada983aa-
        name = name.replace(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}[-_]?/, '');
        // Remove 32-character hash prefix or timestamp prefix
        name = name.replace(/^[0-9a-fA-F]{32}[-_]?/, '');
        name = name.replace(/^\d{10,}[-_]?/, '');
        name = name.replace(/[\\/:*?"<>|]/g, '-').trim();

        if (name && !name.toLowerCase().endsWith('.pdf')) {
            name += '.pdf';
        }
        return name;
    }

    function getPageFallbackTitle() {
        try {
            // Check for UNIT / Chapter / Tutorial near the Back button
            const elements = Array.from(document.querySelectorAll('span, div, h1, h2, h3, h4, p, b, strong, a'));
            for (let i = 0; i < elements.length; i++) {
                const txt = elements[i].innerText ? elements[i].innerText.trim() : '';
                if (txt.match(/^(UNIT|Chapter|Lecture|Tutorial|Assignment)\s*[-_]?\s*\d+/i)) {
                    let clean = txt.replace(/[\\/:*?"<>|]/g, '-').trim();
                    if (!clean.toLowerCase().endsWith('.pdf')) clean += '.pdf';
                    return clean;
                }
            }

            // Check breadcrumb
            const breadcrumbs = document.querySelectorAll('.breadcrumb-item, [class*="breadcrumb"], .subject-name');
            if (breadcrumbs.length > 0) {
                const last = breadcrumbs[breadcrumbs.length - 1].innerText ? breadcrumbs[breadcrumbs.length - 1].innerText.trim() : '';
                if (last && last.length > 2 && !last.includes('Subjects')) {
                    let clean = last.replace(/[\\/:*?"<>|]/g, '-').trim();
                    if (!clean.toLowerCase().endsWith('.pdf')) clean += '.pdf';
                    return clean;
                }
            }

            // Check headings
            const headings = document.querySelectorAll('h1, h2, h3, .title, [class*="title"]');
            for (let i = 0; i < headings.length; i++) {
                const txt = headings[i].innerText ? headings[i].innerText.trim() : '';
                if (txt && txt.length > 2 && txt.length < 60 && !txt.includes('\n')) {
                    let clean = txt.replace(/[\\/:*?"<>|]/g, '-').trim();
                    if (!clean.toLowerCase().endsWith('.pdf')) clean += '.pdf';
                    return clean;
                }
            }
        } catch (e) {}

        if (document.title && document.title.trim().length > 1) {
            let clean = document.title.trim().replace(/[\\/:*?"<>|]/g, '-');
            if (!clean.toLowerCase().endsWith('.pdf')) clean += '.pdf';
            return clean;
        }

        return 'Parul-Document.pdf';
    }

    function determineFilename(candidateUrl, doc) {
        if (candidateUrl) {
            const urlName = cleanPdfFilename(candidateUrl);
            if (urlName && urlName.length > 4 && urlName.toLowerCase() !== '.pdf' && !urlName.toLowerCase().startsWith('parul-')) {
                return urlName;
            }
        }

        if (doc && doc.metadata && doc.metadata.info && doc.metadata.info.Title) {
            let title = doc.metadata.info.Title.replace(/[\\/:*?"<>|]/g, '-').trim();
            if (title.length > 2) {
                if (!title.toLowerCase().endsWith('.pdf')) title += '.pdf';
                return title;
            }
        }

        return getPageFallbackTitle();
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

        const resolvedName = determineFilename(window.__PEWWW_CURRENT_PDF_URL__ || url, window.__PEWWW_PDF_DOC__ || doc);
        if (resolvedName) {
            window.__PEWWW_PDF_NAME__ = resolvedName;
        }

        try {
            window.postMessage({
                type: '__PEWWW_CHECK_STATUS_RES__',
                isLoaded: true,
                url: window.__PEWWW_CURRENT_PDF_URL__,
                filename: window.__PEWWW_PDF_NAME__
            }, '*');
        } catch (e) {}
    }

    // 1. Hook window.fetch
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

    // 4. Hook PDFViewerApplication
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
        a.download = filename || window.__PEWWW_PDF_NAME__ || getPageFallbackTitle();
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

        const filename = window.__PEWWW_PDF_NAME__ || determineFilename(window.__PEWWW_CURRENT_PDF_URL__, window.__PEWWW_PDF_DOC__);

        // Strategy 1: Captured PDF Blob in memory
        if (window.__PEWWW_CURRENT_PDF_BLOB__) {
            triggerBlobDownload(window.__PEWWW_CURRENT_PDF_BLOB__, filename);
            return true;
        }

        // Strategy 2: PDFDocumentProxy
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
                isLoaded: window.__PEWWW_HAS_PDF__ || !!window.PDFViewerApplication || !!document.querySelector('pdf-viewer, ngx-extended-pdf-viewer, .ng2-pdf-viewer-container'),
                filename: window.__PEWWW_PDF_NAME__
            }, '*');
        }
    });

    try {
        window.postMessage({
            type: '__PEWWW_CHECK_STATUS_RES__',
            isLoaded: !!window.PDFViewerApplication || !!document.querySelector('pdf-viewer, ngx-extended-pdf-viewer, .ng2-pdf-viewer-container'),
            filename: window.__PEWWW_PDF_NAME__
        }, '*');
    } catch (e) {}
})();
