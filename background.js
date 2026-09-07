const lastDownloadTimes = new Map();

async function executeSingleDownload(tabId) {
    const now = Date.now();
    const lastTime = lastDownloadTimes.get(tabId) || 0;
    if (now - lastTime < 2500) {
        console.log('[Fcuk-Pewww Background] Debounced: download already in progress.');
        return { success: true, debounced: true };
    }
    lastDownloadTimes.set(tabId, now);

    try {
        // Step 1: Try the top-level frame first
        const topResults = await chrome.scripting.executeScript({
            target: { tabId: tabId },
            world: 'MAIN',
            func: () => {
                try {
                    const app = window.PDFViewerApplication;
                    if (app) {
                        if (typeof app.downloadOrSave === 'function') {
                            app.downloadOrSave();
                            console.log('[Fcuk-Pewww Background] Executed downloadOrSave() in top frame.');
                            return true;
                        }
                        if (typeof app.download === 'function') {
                            app.download();
                            console.log('[Fcuk-Pewww Background] Executed download() in top frame.');
                            return true;
                        }
                    }
                } catch (e) {}

                // Fallback to toolbar download button in top frame
                const btn = document.querySelector('#download, #secondaryDownload');
                if (btn) {
                    btn.click();
                    console.log('[Fcuk-Pewww Background] Clicked #download button in top frame.');
                    return true;
                }
                return false;
            }
        });

        if (topResults && topResults[0] && topResults[0].result === true) {
            return { success: true, frame: 'top' };
        }

        // Step 2: If top frame didn't have it, try child frames (one-by-one check)
        const frameResults = await chrome.scripting.executeScript({
            target: { tabId: tabId, allFrames: true },
            world: 'MAIN',
            func: () => {
                if (window.self === window.top) return false; // already checked top frame
                try {
                    const app = window.PDFViewerApplication;
                    if (app) {
                        if (typeof app.downloadOrSave === 'function') {
                            app.downloadOrSave();
                            return true;
                        }
                        if (typeof app.download === 'function') {
                            app.download();
                            return true;
                        }
                    }
                } catch (e) {}
                const btn = document.querySelector('#download, #secondaryDownload');
                if (btn) {
                    btn.click();
                    return true;
                }
                return false;
            }
        });

        return { success: true };
    } catch (err) {
        console.warn('[Fcuk-Pewww Background] executeSingleDownload error:', err);
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
            return true; // async sendResponse
        }
    }

    if (message.type === 'DOWNLOAD' && message.url) {
        let filename = 'document.pdf';
        try {
            const parsedUrl = new URL(message.url);
            const segments = parsedUrl.pathname.split('/').filter(Boolean);
            if (segments.length > 0) {
                filename = decodeURIComponent(segments[segments.length - 1]);
            }
        } catch (e) {
            const parts = message.url.split('/').pop().split('?')[0];
            if (parts) filename = decodeURIComponent(parts);
        }

        filename = filename.replace(/[/\\?%*:|"<>]/g, '-');
        if (!filename.toLowerCase().endsWith('.pdf')) {
            filename += '.pdf';
        }

        chrome.downloads.download({
            url: message.url,
            filename: filename,
            conflictAction: 'uniquify'
        }, () => {});
    }
});
