const lastDownloadTimes = new Map();

async function executeSingleDownload(tabId) {
    const now = Date.now();
    const lastTime = lastDownloadTimes.get(tabId) || 0;
    if (now - lastTime < 2000) {
        return { success: true, debounced: true };
    }
    lastDownloadTimes.set(tabId, now);

    try {
        const results = await chrome.scripting.executeScript({
            target: { tabId: tabId, allFrames: true },
            world: 'MAIN',
            func: async () => {
                function triggerBlob(blob, filename) {
                    const blobUrl = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = blobUrl;
                    a.download = filename || 'Parul-Course-Material.pdf';
                    document.body.appendChild(a);
                    a.click();
                    setTimeout(() => {
                        a.remove();
                        URL.revokeObjectURL(blobUrl);
                    }, 15000);
                }

                // 1. Captured PDF Blob
                if (window.__PEWWW_CURRENT_PDF_BLOB__) {
                    triggerBlob(window.__PEWWW_CURRENT_PDF_BLOB__, 'Parul-Course-Material.pdf');
                    return true;
                }

                // 2. Captured PDFDocumentProxy from pdfjsLib
                if (window.__PEWWW_PDF_DOC__ && typeof window.__PEWWW_PDF_DOC__.getData === 'function') {
                    try {
                        const data = await window.__PEWWW_PDF_DOC__.getData();
                        if (data && data.length > 0) {
                            triggerBlob(new Blob([data], { type: 'application/pdf' }), 'Parul-Course-Material.pdf');
                            return true;
                        }
                    } catch (e) {}
                }

                // 3. PDFViewerApplication
                const app = window.PDFViewerApplication;
                if (app) {
                    if (app.pdfDocument && typeof app.pdfDocument.getData === 'function') {
                        try {
                            const data = await app.pdfDocument.getData();
                            if (data && data.length > 0) {
                                triggerBlob(new Blob([data], { type: 'application/pdf' }), 'Parul-Course-Material.pdf');
                                return true;
                            }
                        } catch (e) {}
                    }
                    if (typeof app.downloadOrSave === 'function') {
                        app.downloadOrSave();
                        return true;
                    }
                    if (typeof app.download === 'function') {
                        app.download();
                        return true;
                    }
                }

                // 4. Angular component for ng2-pdf-viewer
                const viewerEl = document.querySelector('pdf-viewer, ngx-extended-pdf-viewer');
                if (viewerEl && window.ng && typeof window.ng.getComponent === 'function') {
                    try {
                        const comp = window.ng.getComponent(viewerEl);
                        const pdf = comp && (comp._pdf || comp.pdf || comp.pdfDocument);
                        if (pdf && typeof pdf.getData === 'function') {
                            const data = await pdf.getData();
                            if (data && data.length > 0) {
                                triggerBlob(new Blob([data], { type: 'application/pdf' }), 'Parul-Course-Material.pdf');
                                return true;
                            }
                        }
                    } catch (e) {}
                }

                // 5. Toolbar download button
                const btn = document.querySelector('#download, #secondaryDownload');
                if (btn) {
                    btn.click();
                    return true;
                }

                // 6. Direct PDF URL
                if (window.__PEWWW_CURRENT_PDF_URL__) {
                    const a = document.createElement('a');
                    a.href = window.__PEWWW_CURRENT_PDF_URL__;
                    a.download = 'Parul-Course-Material.pdf';
                    a.target = '_blank';
                    document.body.appendChild(a);
                    a.click();
                    setTimeout(() => a.remove(), 2000);
                    return true;
                }

                return false;
            }
        });

        // Fallback: check performance resource entries
        if (!results || !results.some(r => r && r.result === true)) {
            const perfResults = await chrome.scripting.executeScript({
                target: { tabId: tabId },
                world: 'MAIN',
                func: () => {
                    try {
                        const resources = performance.getEntriesByType('resource');
                        for (let i = resources.length - 1; i >= 0; i--) {
                            const name = resources[i].name || '';
                            if (name.includes('.pdf') || (name.includes('storage.googleapis.com') && name.includes('parul'))) {
                                return name;
                            }
                        }
                    } catch (e) {}
                    return null;
                }
            });
            if (perfResults && perfResults[0] && perfResults[0].result) {
                chrome.downloads.download({
                    url: perfResults[0].result,
                    filename: 'Parul-Course-Material.pdf',
                    conflictAction: 'uniquify'
                });
                return { success: true };
            }
        }

        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'EXECUTE_MAIN_WORLD_DOWNLOAD' || message.type === 'TRIGGER_SINGLE_DOWNLOAD') {
        const tabId = (sender.tab && sender.tab.id) || message.tabId;
        if (tabId) {
            executeSingleDownload(tabId).then((res) => {
                sendResponse(res);
            });
            return true;
        }
    }

    if (message.type === 'DOWNLOAD' && message.url) {
        let filename = message.filename || 'Parul-Course-Material.pdf';
        filename = filename.replace(/[\\/:*?"<>|]/g, '-').trim();
        if (!filename.toLowerCase().endsWith('.pdf')) filename += '.pdf';

        chrome.downloads.download({
            url: message.url,
            filename: filename,
            conflictAction: 'uniquify'
        });
    }
});
