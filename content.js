(function () {
    'use strict';

    let lastDownloadTime = 0;
    let isExecutingDownload = false;
    let childFrameHasPdf = false;
    let injectAppLoaded = false;
    let currentFilename = null;
    let isBatchRunning = false;
    let batchCancelRequested = false;

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function cleanPdfFilename(raw) {
        if (!raw || typeof raw !== 'string') return '';
        let str = raw;
        try { str = decodeURIComponent(decodeURIComponent(str)); } catch (e) {}
        let name = str.split('?')[0].split('/').pop();
        name = name.replace(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}[-_]?/, '');
        name = name.replace(/^[0-9a-fA-F]{32}[-_]?/, '');
        name = name.replace(/^\d{10,}[-_]?/, '');
        name = name.replace(/[\\/:*?"<>|]/g, '-').trim();
        if (name && !name.toLowerCase().endsWith('.pdf')) name += '.pdf';
        return name;
    }

    function extractLivePageTitle() {
        try {
            const elements = Array.from(document.querySelectorAll('span, div, h1, h2, h3, h4, p, b, strong, a'));
            for (let i = 0; i < elements.length; i++) {
                const txt = elements[i].innerText ? elements[i].innerText.trim() : '';
                if (txt.match(/^(UNIT|Chapter|Lecture|Tutorial|Assignment)\s*[-_]?\s*\d+/i)) {
                    let clean = txt.replace(/[\\/:*?"<>|]/g, '-').trim();
                    if (!clean.toLowerCase().endsWith('.pdf')) clean += '.pdf';
                    return clean;
                }
            }

            const breadcrumbs = document.querySelectorAll('.breadcrumb-item, [class*="breadcrumb"], .subject-name');
            if (breadcrumbs.length > 0) {
                const last = breadcrumbs[breadcrumbs.length - 1].innerText ? breadcrumbs[breadcrumbs.length - 1].innerText.trim() : '';
                if (last && last.length > 2 && !last.includes('Subjects')) {
                    let clean = last.replace(/[\\/:*?"<>|]/g, '-').trim();
                    if (!clean.toLowerCase().endsWith('.pdf')) clean += '.pdf';
                    return clean;
                }
            }

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

    function findPaginationControls() {
        let prevBtn = null;
        let nextBtn = null;
        let currentIdx = 1;
        let totalCount = 1;

        const allButtons = Array.from(document.querySelectorAll('button, a, [role="button"], span, div'));
        for (const el of allButtons) {
            const txt = (el.innerText || '').trim();
            const match = txt.match(/^(\d+)\s*\/\s*(\d+)$/);
            if (match && el.children.length === 0) {
                currentIdx = parseInt(match[1], 10);
                totalCount = parseInt(match[2], 10);

                const parent = el.parentElement;
                if (parent) {
                    const siblings = Array.from(parent.querySelectorAll('button, a, [role="button"]'));
                    for (const s of siblings) {
                        const sTxt = (s.innerText || '').toLowerCase();
                        if (sTxt.includes('prev')) prevBtn = s;
                        if (sTxt.includes('next')) nextBtn = s;
                    }
                }
                break;
            }
        }

        if (!nextBtn) {
            nextBtn = allButtons.find(el => {
                const txt = (el.innerText || '').trim().toLowerCase();
                return (txt === 'next >' || txt === 'next' || txt.startsWith('next')) && (el.tagName === 'BUTTON' || el.tagName === 'A');
            });
        }

        return { prevBtn, nextBtn, currentIdx, totalCount };
    }

    function findSidebarMaterials() {
        const list = [];
        const items = document.querySelectorAll(
            '.mat-list-item, [class*="material-list"] [class*="item"], [class*="sidebar"] [class*="item"], [class*="content-item"], li[class*="item"]'
        );
        items.forEach(el => {
            const txt = el.innerText ? el.innerText.trim() : '';
            if (txt && !txt.includes('Show ') && (txt.includes('Tutorial') || txt.includes('Lecture') || txt.includes('UNIT') || txt.includes('Assignment') || txt.includes('NEW MATERIAL'))) {
                list.push(el);
            }
        });
        return list;
    }

    function resetNavState() {
        currentFilename = null;
        injectAppLoaded = false;
        childFrameHasPdf = false;
    }

    document.addEventListener('click', function (e) {
        const target = e.target && e.target.closest('button, a, [role="button"], li, mat-list-item');
        if (target) {
            const txt = (target.innerText || '').toLowerCase();
            if (
                txt.includes('next') ||
                txt.includes('prev') ||
                txt.includes('unit') ||
                txt.includes('chapter') ||
                txt.includes('tutorial') ||
                txt.includes('assignment') ||
                txt.includes('back')
            ) {
                resetNavState();
                setTimeout(() => updateVisibility(), 300);
            }
        }
    }, true);

    window.addEventListener('popstate', resetNavState);
    window.addEventListener('hashchange', resetNavState);

    window.addEventListener('message', function (e) {
        if (!e.data) return;
        if (e.data.type === '__PEWWW_CHECK_STATUS_RES__') {
            injectAppLoaded = !!e.data.isLoaded;
            if (e.data.filename) currentFilename = e.data.filename;
            updateVisibility();
        } else if (e.data.type === '__PEWWW_CHILD_PDF_STATE__') {
            childFrameHasPdf = !!e.data.isOpen;
            if (e.data.filename) currentFilename = e.data.filename;
            updateVisibility();
        } else if (e.data.type === '__PEWWW_KEY_TRIGGER__') {
            if (isPdfOpen()) {
                triggerDownload();
            }
        } else if (e.data.type === '__PEWWW_DOWNLOAD_SUCCESS__' || e.data.type === '__PEWWW_DOCUMENT_LOADED__') {
            injectAppLoaded = true;
            if (e.data.filename) currentFilename = e.data.filename;
            updateVisibility();
            if (e.data.type === '__PEWWW_DOWNLOAD_SUCCESS__') {
                showFeedbackToast();
            }
        }
    });

    function cleanupOldButtons() {
        const obsoleteIds = [
            'fcuk-pewww-top-btn',
            'fcuk-pewww-bottom-btn',
            'fcuk-pewww-floating-btn',
            'stealth-dl-btn',
            'parul-floating-dl-btn',
            'fcuk-pewww-engine',
            'fcuk-pewww-main-engine'
        ];
        obsoleteIds.forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.remove();
        });
    }

    function injectExternalScript() {
        if (document.getElementById('pewww-ext-script')) return;
        try {
            const script = document.createElement('script');
            script.id = 'pewww-ext-script';
            script.src = chrome.runtime.getURL('inject.js');
            (document.head || document.documentElement).appendChild(script);
        } catch (e) {}
    }

    function isPdfOpen() {
        currentFilename = extractLivePageTitle();

        if (childFrameHasPdf || injectAppLoaded) return true;

        const viewerSelectors = [
            'pdf-viewer',
            'ngx-extended-pdf-viewer',
            '.ng2-pdf-viewer-container',
            '#viewerContainer',
            '.pdfViewer',
            '#outerContainer',
            'embed[type="application/pdf"]',
            'object[type="application/pdf"]'
        ];

        for (const selector of viewerSelectors) {
            const el = document.querySelector(selector);
            if (el) {
                const style = window.getComputedStyle(el);
                if (style.display !== 'none' && style.visibility !== 'hidden') {
                    const src = el.getAttribute('ng-reflect-src') || el.getAttribute('src');
                    if (src) {
                        const extracted = cleanPdfFilename(src);
                        if (extracted && extracted.length > 4) currentFilename = extracted;
                    }
                    return true;
                }
            }
        }

        const canvases = document.querySelectorAll('pdf-viewer canvas, .pdfViewer canvas, #viewerContainer canvas, div[class*="viewer"] canvas, div[class*="pdf"] canvas');
        if (canvases.length > 0) {
            for (const c of canvases) {
                if (c.width >= 50 && c.height >= 50) return true;
            }
        }

        const path = window.location.href.toLowerCase();
        if (path.includes('classrooms') || path.includes('subjects') || path.includes('elearning')) {
            const anyCanvas = document.querySelectorAll('canvas');
            for (const c of anyCanvas) {
                const rect = c.getBoundingClientRect();
                if (rect.width >= 120 && rect.height >= 120) {
                    return true;
                }
            }
        }

        const iframes = document.querySelectorAll('iframe');
        for (const frame of iframes) {
            try {
                const src = (frame.src || '').toLowerCase();
                if (src.includes('.pdf') || src.includes('blob:') || src.includes('viewer')) {
                    return true;
                }
                const doc = frame.contentDocument;
                if (doc) {
                    const innerViewer = doc.querySelector('pdf-viewer, ngx-extended-pdf-viewer, #viewerContainer, .pdfViewer, canvas');
                    if (innerViewer) return true;
                }
            } catch (e) {}
        }

        return false;
    }

    function triggerDownload() {
        const now = Date.now();
        if (now - lastDownloadTime < 1800 || isExecutingDownload) {
            return;
        }
        lastDownloadTime = now;
        isExecutingDownload = true;
        setTimeout(() => { isExecutingDownload = false; }, 1800);

        const filename = extractLivePageTitle();
        currentFilename = filename;

        showFeedbackToast();

        try {
            window.postMessage({
                type: '__PEWWW_EXECUTE_DOWNLOAD__',
                filename: filename
            }, '*');
        } catch (e) {}
    }

    // AUTOMATED BATCH RUNNER: ALL SLIDES (1 to 7)
    async function startBatchSlidesRunner() {
        if (isBatchRunning) return;
        isBatchRunning = true;
        batchCancelRequested = false;

        try {
            let controls = findPaginationControls();
            let total = controls.totalCount > 1 ? controls.totalCount : 7;
            let current = controls.currentIdx || 1;

            broadcastBatchProgress(Math.round((current / total) * 100), `Starting slide batch runner (${current}/${total})...`);

            while (current <= total && !batchCancelRequested) {
                await sleep(600);

                const filename = extractLivePageTitle();
                broadcastBatchProgress(Math.round((current / total) * 100), `Saving Slide ${current} of ${total}: ${filename}...`);

                triggerDownload();
                await sleep(2000);

                if (current >= total || batchCancelRequested) break;

                controls = findPaginationControls();
                if (controls.nextBtn && !controls.nextBtn.disabled) {
                    broadcastBatchProgress(Math.round((current / total) * 100), `Moving to slide ${current + 1} of ${total}...`);
                    controls.nextBtn.click();
                    await sleep(2800); // Wait for Angular to transition and load the new PDF
                    controls = findPaginationControls();
                    current = controls.currentIdx || (current + 1);
                } else {
                    break;
                }
            }

            if (batchCancelRequested) {
                broadcastBatchProgress(0, 'Batch download cancelled.', true);
            } else {
                broadcastBatchProgress(100, `🎉 All ${total} slides downloaded successfully!`, true);
            }
        } catch (err) {
            broadcastBatchProgress(0, 'Batch error: ' + err.message, true);
        } finally {
            isBatchRunning = false;
        }
    }

    // AUTOMATED BATCH RUNNER: ALL NOTES IN SIDEBAR
    async function startBatchNotesRunner() {
        if (isBatchRunning) return;
        isBatchRunning = true;
        batchCancelRequested = false;

        try {
            const items = findSidebarMaterials();
            if (items.length === 0) {
                broadcastBatchProgress(0, 'No sidebar material items detected.', true);
                isBatchRunning = false;
                return;
            }

            const total = items.length;
            broadcastBatchProgress(5, `Found ${total} materials. Starting downloads...`);

            for (let i = 0; i < total; i++) {
                if (batchCancelRequested) break;

                const item = items[i];
                item.click();
                await sleep(2800); // Wait for viewer to render selected note

                const filename = extractLivePageTitle();
                const pct = Math.round(((i + 1) / total) * 100);
                broadcastBatchProgress(pct, `Downloaded ${i + 1}/${total}: ${filename}...`);

                triggerDownload();
                await sleep(2000);
            }

            if (batchCancelRequested) {
                broadcastBatchProgress(0, 'Batch notes cancelled.', true);
            } else {
                broadcastBatchProgress(100, `🎉 All ${total} materials downloaded successfully!`, true);
            }
        } catch (err) {
            broadcastBatchProgress(0, 'Batch error: ' + err.message, true);
        } finally {
            isBatchRunning = false;
        }
    }

    function broadcastBatchProgress(percent, text, done = false) {
        showFeedbackToast(text);
        try {
            chrome.runtime.sendMessage({
                type: '__PEWWW_BATCH_PROGRESS__',
                percent: percent,
                text: text,
                done: done
            });
        } catch (e) {}
    }

    function handleKeyShortcut(e) {
        const isCtrlOrCmd = e.ctrlKey || e.metaKey;
        const isS = e.code === 'KeyS' || (e.key && e.key.toLowerCase() === 's');
        const isAltD = e.altKey && (e.code === 'KeyD' || (e.key && e.key.toLowerCase() === 'd'));

        if ((isCtrlOrCmd && isS) || isAltD) {
            if (!isPdfOpen()) return;

            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            const now = Date.now();
            if (now - lastDownloadTime < 2000 || isExecutingDownload) return;

            if (window.self !== window.top) {
                window.top.postMessage({ type: '__PEWWW_KEY_TRIGGER__' }, '*');
            } else {
                triggerDownload();
            }
        }
    }

    window.addEventListener('keydown', handleKeyShortcut, true);

    function bindAllFrames() {
        document.querySelectorAll('iframe').forEach((frame) => {
            try {
                if (frame.contentWindow && !frame.__pewww_bound__) {
                    frame.__pewww_bound__ = true;
                    frame.contentWindow.addEventListener('keydown', handleKeyShortcut, true);
                }
            } catch (e) {}
        });
    }
    setInterval(bindAllFrames, 1500);

    if (window.self !== window.top) {
        function checkFramePdf() {
            try {
                const hasPdf = isPdfOpen();
                window.top.postMessage({
                    type: '__PEWWW_CHILD_PDF_STATE__',
                    isOpen: hasPdf,
                    filename: extractLivePageTitle()
                }, '*');
            } catch (e) {}
        }
        setInterval(checkFramePdf, 800);
        checkFramePdf();
        return;
    }

    function showFeedbackToast(customMsg) {
        let toast = document.getElementById('claude-pdf-toast');
        const displayName = customMsg || ('Saving ' + (currentFilename || extractLivePageTitle()) + '...');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'claude-pdf-toast';
            toast.style.cssText = `
                position: fixed !important;
                bottom: 82px !important;
                right: 28px !important;
                z-index: 2147483647 !important;
                background: rgba(26, 25, 23, 0.96) !important;
                backdrop-filter: blur(16px) !important;
                -webkit-backdrop-filter: blur(16px) !important;
                border: 1px solid rgba(52, 211, 153, 0.4) !important;
                border-radius: 12px !important;
                padding: 10px 16px !important;
                color: #FAF8F5 !important;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
                font-size: 13px !important;
                font-weight: 600 !important;
                display: flex !important;
                align-items: center !important;
                gap: 8px !important;
                box-shadow: 0 10px 30px rgba(0,0,0,0.6), 0 0 15px rgba(52, 211, 153, 0.2) !important;
                transition: opacity 0.25s ease, transform 0.25s ease, visibility 0.25s !important;
                opacity: 0 !important;
                visibility: hidden !important;
                transform: translateY(8px) !important;
                pointer-events: none !important;
                max-width: 360px !important;
            `;
            (document.body || document.documentElement).appendChild(toast);
        }

        toast.innerHTML = `
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#34D399" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${displayName}</span>
        `;

        toast.style.visibility = 'visible';
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';

        setTimeout(() => {
            if (toast && !isBatchRunning) {
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(8px)';
                setTimeout(() => {
                    if (toast) toast.style.visibility = 'hidden';
                }, 250);
            }
        }, 2200);
    }

    function getOrCreateClaudePill() {
        let pill = document.getElementById('claude-pdf-pill');
        if (pill) return pill;

        pill = document.createElement('div');
        pill.id = 'claude-pdf-pill';
        pill.innerHTML = `
            <div id="claude-pill-dl-single" style="display: flex; align-items: center; gap: 9px; cursor: pointer;">
                <div id="claude-pill-icon-box" style="
                    width: 28px;
                    height: 28px;
                    border-radius: 50%;
                    background: rgba(217, 119, 87, 0.15);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.3s ease;
                ">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#D97757" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                </div>
                <span id="claude-pill-text" style="
                    font-size: 13.5px;
                    font-weight: 600;
                    color: #FAF8F5;
                    letter-spacing: -0.015em;
                ">Download PDF</span>
            </div>
            <div id="claude-pill-batch-btn" style="
                background: rgba(217, 119, 87, 0.18);
                border: 1px solid rgba(217, 119, 87, 0.35);
                color: #FAF8F5;
                font-size: 11px;
                font-weight: 600;
                padding: 3px 8px;
                border-radius: 50px;
                cursor: pointer;
                transition: all 0.2s ease;
            " title="Click to auto-download all 7 slides sequentially">⚡ All Slides</div>
            <div style="
                background: rgba(255, 255, 255, 0.08);
                border: 1px solid rgba(255, 255, 255, 0.1);
                color: #A8A29E;
                font-size: 10.5px;
                font-weight: 600;
                font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                padding: 3px 6px;
                border-radius: 5px;
                letter-spacing: 0.02em;
                line-height: 1;
            ">Ctrl+S</div>
        `;

        pill.style.cssText = `
            position: fixed !important;
            bottom: 28px !important;
            right: 28px !important;
            z-index: 2147483647 !important;
            background: rgba(26, 25, 23, 0.94) !important;
            backdrop-filter: blur(18px) saturate(180%) !important;
            -webkit-backdrop-filter: blur(18px) saturate(180%) !important;
            border: 1px solid rgba(224, 216, 204, 0.16) !important;
            border-radius: 9999px !important;
            padding: 8px 14px 8px 10px !important;
            display: flex !important;
            align-items: center !important;
            gap: 10px !important;
            box-shadow: 0 12px 32px -4px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(217, 119, 87, 0.12) !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
            user-select: none !important;
            opacity: 0 !important;
            visibility: hidden !important;
            transform: translateY(16px) !important;
            pointer-events: none !important;
            transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1), transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.3s, border-color 0.2s, box-shadow 0.2s !important;
        `;

        const singleBtn = pill.querySelector('#claude-pill-dl-single');
        if (singleBtn) {
            singleBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                triggerDownload();
            };
        }

        const batchBtn = pill.querySelector('#claude-pill-batch-btn');
        if (batchBtn) {
            batchBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                startBatchSlidesRunner();
            };
            batchBtn.onmouseenter = () => {
                batchBtn.style.background = 'rgba(217, 119, 87, 0.35)';
            };
            batchBtn.onmouseleave = () => {
                batchBtn.style.background = 'rgba(217, 119, 87, 0.18)';
            };
        }

        pill.onmouseenter = () => {
            pill.style.transform = 'translateY(-2px) scale(1.02)';
            pill.style.borderColor = 'rgba(217, 119, 87, 0.4)';
            pill.style.boxShadow = '0 16px 36px -4px rgba(0, 0, 0, 0.6), 0 0 20px rgba(217, 119, 87, 0.25)';
            const iconBox = document.getElementById('claude-pill-icon-box');
            if (iconBox) iconBox.style.background = 'rgba(217, 119, 87, 0.25)';
            const liveName = extractLivePageTitle();
            if (liveName) pill.title = 'Download: ' + liveName;
        };

        pill.onmouseleave = () => {
            pill.style.transform = 'translateY(0) scale(1)';
            pill.style.borderColor = 'rgba(224, 216, 204, 0.16)';
            pill.style.boxShadow = '0 12px 32px -4px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(217, 119, 87, 0.12)';
            const iconBox = document.getElementById('claude-pill-icon-box');
            if (iconBox) iconBox.style.background = 'rgba(217, 119, 87, 0.15)';
        };

        const root = document.documentElement || document.body;
        if (root) root.appendChild(pill);

        return pill;
    }

    function updateVisibility() {
        cleanupOldButtons();
        injectExternalScript();

        const pill = getOrCreateClaudePill();
        if (!pill) return;

        const open = isPdfOpen();
        if (open) {
            pill.style.visibility = 'visible';
            pill.style.opacity = '1';
            pill.style.transform = 'translateY(0)';
            pill.style.pointerEvents = 'auto';

            const pagination = findPaginationControls();
            const batchPillBtn = document.getElementById('claude-pill-batch-btn');
            if (batchPillBtn && pagination.totalCount > 1) {
                batchPillBtn.textContent = `⚡ All (${pagination.totalCount})`;
                batchPillBtn.style.display = 'block';
            } else if (batchPillBtn) {
                batchPillBtn.style.display = 'none';
            }
        } else {
            pill.style.opacity = '0';
            pill.style.transform = 'translateY(16px)';
            pill.style.pointerEvents = 'none';
            setTimeout(() => {
                if (!isPdfOpen()) {
                    pill.style.visibility = 'hidden';
                }
            }, 300);
        }
    }

    updateVisibility();
    setInterval(updateVisibility, 500);

    const observer = new MutationObserver(() => updateVisibility());
    observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class', 'hidden']
    });

    window.addEventListener('resize', updateVisibility);

    // Extension popup message listener
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.type === 'TRIGGER_DOWNLOAD') {
            triggerDownload();
            sendResponse({ success: true, filename: extractLivePageTitle() });
        } else if (request.type === 'CHECK_PDF_STATUS') {
            const pagination = findPaginationControls();
            sendResponse({
                isOpen: isPdfOpen(),
                filename: extractLivePageTitle(),
                pagination: { current: pagination.currentIdx, total: pagination.totalCount }
            });
        } else if (request.type === 'START_BATCH_SLIDES') {
            startBatchSlidesRunner();
            sendResponse({ started: true });
        } else if (request.type === 'START_BATCH_NOTES') {
            startBatchNotesRunner();
            sendResponse({ started: true });
        } else if (request.type === 'CANCEL_BATCH') {
            batchCancelRequested = true;
            sendResponse({ cancelled: true });
        }
    });
})();
