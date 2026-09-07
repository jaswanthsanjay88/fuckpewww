(function () {
    'use strict';

    let isDownloading = false;

    function isAppLoaded() {
        try {
            const app = window.PDFViewerApplication;
            if (app && (app.pdfDocument || (app.pagesCount && app.pagesCount > 0))) {
                return true;
            }
        } catch (e) {}
        return false;
    }

    function runDownload() {
        if (isDownloading) {
            console.log('[Fcuk-Pewww Inject] Download debounced in inject.js.');
            return false;
        }
        isDownloading = true;
        setTimeout(() => { isDownloading = false; }, 2500);

        console.log('[Fcuk-Pewww Inject] Triggering download via PDFViewerApplication...');

        // 1. Direct window.PDFViewerApplication on current window
        try {
            const app = window.PDFViewerApplication;
            if (app) {
                if (typeof app.downloadOrSave === 'function') {
                    app.downloadOrSave();
                    console.log('[Fcuk-Pewww Inject] Executed window.PDFViewerApplication.downloadOrSave()');
                    window.postMessage({ type: '__PEWWW_DOWNLOAD_SUCCESS__' }, '*');
                    return true;
                }
                if (typeof app.download === 'function') {
                    app.download();
                    console.log('[Fcuk-Pewww Inject] Executed window.PDFViewerApplication.download()');
                    window.postMessage({ type: '__PEWWW_DOWNLOAD_SUCCESS__' }, '*');
                    return true;
                }
            }
        } catch (e) {
            console.warn('[Fcuk-Pewww Inject] Error calling PDFViewerApplication:', e);
        }

        // 2. Check child iframes for PDFViewerApplication
        try {
            const iframes = document.querySelectorAll('iframe');
            for (const frame of iframes) {
                try {
                    const frameApp = frame.contentWindow && frame.contentWindow.PDFViewerApplication;
                    if (frameApp) {
                        if (typeof frameApp.downloadOrSave === 'function') {
                            frameApp.downloadOrSave();
                            console.log('[Fcuk-Pewww Inject] Executed iframe PDFViewerApplication.downloadOrSave()');
                            window.postMessage({ type: '__PEWWW_DOWNLOAD_SUCCESS__' }, '*');
                            return true;
                        }
                        if (typeof frameApp.download === 'function') {
                            frameApp.download();
                            console.log('[Fcuk-Pewww Inject] Executed iframe PDFViewerApplication.download()');
                            window.postMessage({ type: '__PEWWW_DOWNLOAD_SUCCESS__' }, '*');
                            return true;
                        }
                    }
                } catch (frameErr) {}
            }
        } catch (e) {}

        // 3. Fallback: native toolbar buttons in DOM ONLY if app not present
        try {
            const btn = document.querySelector('#download, #secondaryDownload');
            if (btn) {
                btn.click();
                console.log('[Fcuk-Pewww Inject] Clicked native toolbar download button.');
                window.postMessage({ type: '__PEWWW_DOWNLOAD_SUCCESS__' }, '*');
                return true;
            }
        } catch (e) {}

        return false;
    }

    // Listen for download triggers from content script
    window.addEventListener('message', function (e) {
        if (e.source !== window || !e.data) return;
        if (e.data.type === '__PEWWW_EXECUTE_DOWNLOAD__') {
            runDownload();
        } else if (e.data.type === '__PEWWW_CHECK_STATUS_REQ__') {
            window.postMessage({
                type: '__PEWWW_CHECK_STATUS_RES__',
                isLoaded: isAppLoaded()
            }, '*');
        }
    });

    // Announce initial status
    try {
        window.postMessage({
            type: '__PEWWW_CHECK_STATUS_RES__',
            isLoaded: isAppLoaded()
        }, '*');
    } catch (e) {}
})();
