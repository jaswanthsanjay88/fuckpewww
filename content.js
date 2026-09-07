(function () {
    'use strict';

    let lastDownloadTime = 0;
    let childFrameHasPdf = false;
    let injectAppLoaded = false;

    // Listen for messages from inject.js and child iframes
    window.addEventListener('message', function (e) {
        if (!e.data) return;
        if (e.data.type === '__PEWWW_CHECK_STATUS_RES__') {
            injectAppLoaded = !!e.data.isLoaded;
            updateVisibility();
        } else if (e.data.type === '__PEWWW_CHILD_PDF_STATE__') {
            childFrameHasPdf = !!e.data.isOpen;
            updateVisibility();
        } else if (e.data.type === '__PEWWW_KEY_TRIGGER__') {
            // Received shortcut trigger from a focused child iframe
            if (isPdfOpen()) {
                triggerDownload();
            }
        } else if (e.data.type === '__PEWWW_DOWNLOAD_SUCCESS__') {
            showFeedbackToast();
        }
    });

    // Clean up any legacy or duplicate buttons
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

    // Inject external inject.js via script.src (100% CSP compliant)
    function injectExternalScript() {
        if (document.getElementById('pewww-ext-script')) return;
        try {
            const script = document.createElement('script');
            script.id = 'pewww-ext-script';
            script.src = chrome.runtime.getURL('inject.js');
            (document.head || document.documentElement).appendChild(script);
        } catch (e) {}
    }

    // Helper: Verify if a DOM element is truly visible on screen
    function isElementVisible(el) {
        if (!el || !el.isConnected) return false;

        if (typeof el.checkVisibility === 'function') {
            if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) {
                return false;
            }
        }

        const style = window.getComputedStyle(el);
        if (
            style.display === 'none' ||
            style.visibility === 'hidden' ||
            style.visibility === 'collapse' ||
            style.opacity === '0'
        ) {
            return false;
        }

        const rect = el.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
            return false;
        }

        if (style.position !== 'fixed' && style.position !== 'sticky' && el.offsetParent === null) {
            return false;
        }

        return true;
    }

    // Precise check: Is a PDF document actively open and visible right now?
    function isPdfOpen() {
        // A. Check for core PDF viewer elements visibly rendered on screen
        const viewerSelectors = [
            'ngx-extended-pdf-viewer',
            '#viewerContainer',
            '.pdfViewer',
            '#outerContainer',
            'pdf-viewer',
            'embed[type="application/pdf"]',
            'object[type="application/pdf"]'
        ];

        for (const selector of viewerSelectors) {
            const elements = document.querySelectorAll(selector);
            for (const el of elements) {
                if (isElementVisible(el)) {
                    const rect = el.getBoundingClientRect();
                    if (rect.width >= 100 && rect.height >= 100) {
                        return true;
                    }
                }
            }
        }

        // B. Check for active, visible toolbar download button
        const toolbarBtn = document.querySelector('#download, #secondaryDownload');
        if (toolbarBtn && isElementVisible(toolbarBtn)) {
            const rect = toolbarBtn.getBoundingClientRect();
            if (rect.width >= 10 && rect.height >= 10) {
                return true;
            }
        }

        // C. Check visible iframes
        const iframes = document.querySelectorAll('iframe');
        for (const frame of iframes) {
            try {
                if (!isElementVisible(frame)) continue;
                const rect = frame.getBoundingClientRect();
                if (rect.width < 120 || rect.height < 120) continue;

                const src = (frame.src || '').toLowerCase();
                if (src.includes('.pdf') || src.includes('blob:') || src.includes('viewer')) {
                    return true;
                }

                const doc = frame.contentDocument;
                if (doc) {
                    const innerViewer = doc.querySelector('ngx-extended-pdf-viewer, #viewerContainer, .pdfViewer, #outerContainer, #download');
                    if (innerViewer && isElementVisible(innerViewer)) {
                        return true;
                    }
                }
            } catch (e) {}
        }

        // D. Child frame or inject.js state confirmation
        if (childFrameHasPdf) return true;
        if (injectAppLoaded) {
            const container = document.querySelector('ngx-extended-pdf-viewer, #viewerContainer, .pdfViewer');
            if (container && isElementVisible(container)) {
                return true;
            }
        }

        return false;
    }

    // Single coordinated download trigger with 2500ms debounce
    function triggerDownload() {
        const now = Date.now();
        if (now - lastDownloadTime < 2500) {
            console.log('[Fcuk-Pewww] Debounced: download already initiated.');
            return;
        }
        lastDownloadTime = now;

        console.log('[Fcuk-Pewww] Executing single download...');
        showFeedbackToast();

        // 1. Send single request to background service worker (MAIN world execution, 0 CSP)
        try {
            chrome.runtime.sendMessage({ type: 'EXECUTE_MAIN_WORLD_DOWNLOAD' });
        } catch (err) {
            // Fallback to inject.js if background messaging fails
            try {
                window.postMessage({ type: '__PEWWW_EXECUTE_DOWNLOAD__' }, '*');
            } catch (e) {}
        }
    }

    // Keyboard shortcut handler (Ctrl+S / Cmd+S / Alt+D)
    function handleKeyShortcut(e) {
        const isCtrlOrCmd = e.ctrlKey || e.metaKey;
        const isS = e.code === 'KeyS' || (e.key && e.key.toLowerCase() === 's');
        const isAltD = e.altKey && (e.code === 'KeyD' || (e.key && e.key.toLowerCase() === 'd'));

        if ((isCtrlOrCmd && isS) || isAltD) {
            if (!isPdfOpen()) {
                return; // Do not intercept if no PDF is open
            }

            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            if (window.self !== window.top) {
                // If focused inside an iframe, delegate to top window to prevent duplicate firing
                window.top.postMessage({ type: '__PEWWW_KEY_TRIGGER__' }, '*');
            } else {
                triggerDownload();
            }
        }
    }

    window.addEventListener('keydown', handleKeyShortcut, true);
    document.addEventListener('keydown', handleKeyShortcut, true);

    // Deep iframe binding to catch shortcuts when PDF viewer iframe is focused
    function bindAllFrames() {
        document.querySelectorAll('iframe').forEach((frame) => {
            try {
                if (frame.contentWindow && !frame.__pewww_bound__) {
                    frame.__pewww_bound__ = true;
                    frame.contentWindow.addEventListener('keydown', handleKeyShortcut, true);
                    if (frame.contentDocument) {
                        frame.contentDocument.addEventListener('keydown', handleKeyShortcut, true);
                    }
                }
            } catch (e) {}
        });
    }
    setInterval(bindAllFrames, 1200);

    // IFRAME-ONLY LOGIC: If running inside a child frame, report state and exit
    if (window.self !== window.top) {
        function checkFramePdf() {
            try {
                const hasPdf = isPdfOpen();
                window.top.postMessage({ type: '__PEWWW_CHILD_PDF_STATE__', isOpen: hasPdf }, '*');
            } catch (e) {}
        }
        setInterval(checkFramePdf, 800);
        checkFramePdf();
        return; // Never render UI pill inside iframes
    }

    // ==========================================
    // TOP-LEVEL WINDOW: UI Pill & Feedback Toast
    // ==========================================

    function showFeedbackToast() {
        let toast = document.getElementById('claude-pdf-toast');
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
            `;
            toast.innerHTML = `
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#34D399" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>Downloading document...</span>
            `;
            (document.body || document.documentElement).appendChild(toast);
        }

        toast.style.visibility = 'visible';
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';

        triggerPillVisualFeedback();

        setTimeout(() => {
            if (toast) {
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(8px)';
                setTimeout(() => {
                    if (toast) toast.style.visibility = 'hidden';
                }, 250);
            }
        }, 2200);
    }

    function triggerPillVisualFeedback() {
        const text = document.getElementById('claude-pill-text');
        const iconBox = document.getElementById('claude-pill-icon-box');

        if (text && iconBox) {
            text.textContent = 'Downloading...';
            text.style.color = '#34D399';
            iconBox.innerHTML = `
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#34D399" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            `;
            iconBox.style.background = 'rgba(52, 211, 153, 0.18)';

            setTimeout(() => {
                text.textContent = 'Download PDF';
                text.style.color = '#FAF8F5';
                iconBox.innerHTML = `
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#D97757" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                `;
                iconBox.style.background = 'rgba(217, 119, 87, 0.15)';
            }, 2400);
        }
    }

    // Claude-style UI/UX Pro Max Floating Capsule
    function getOrCreateClaudePill() {
        let pill = document.getElementById('claude-pdf-pill');
        if (pill) return pill;

        pill = document.createElement('div');
        pill.id = 'claude-pdf-pill';
        pill.innerHTML = `
            <div style="display: flex; align-items: center; gap: 9px;">
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
            gap: 12px !important;
            cursor: pointer !important;
            box-shadow: 0 12px 32px -4px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(217, 119, 87, 0.12) !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Inter', sans-serif !important;
            user-select: none !important;
            opacity: 0 !important;
            visibility: hidden !important;
            transform: translateY(16px) !important;
            pointer-events: none !important;
            transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1), transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.3s, border-color 0.2s, box-shadow 0.2s !important;
        `;

        pill.onmouseenter = () => {
            pill.style.transform = 'translateY(-2px) scale(1.02)';
            pill.style.borderColor = 'rgba(217, 119, 87, 0.4)';
            pill.style.boxShadow = '0 16px 36px -4px rgba(0, 0, 0, 0.6), 0 0 20px rgba(217, 119, 87, 0.25)';
            const iconBox = document.getElementById('claude-pill-icon-box');
            if (iconBox) iconBox.style.background = 'rgba(217, 119, 87, 0.25)';
        };

        pill.onmouseleave = () => {
            pill.style.transform = 'translateY(0) scale(1)';
            pill.style.borderColor = 'rgba(224, 216, 204, 0.16)';
            pill.style.boxShadow = '0 12px 32px -4px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(217, 119, 87, 0.12)';
            const iconBox = document.getElementById('claude-pill-icon-box');
            if (iconBox) iconBox.style.background = 'rgba(217, 119, 87, 0.15)';
        };

        pill.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            triggerDownload();
        };

        const root = document.documentElement || document.body;
        if (root) root.appendChild(pill);

        return pill;
    }

    // Dynamic Visibility: Smoothly show ONLY when PDF is open, smoothly hide when PDF is closed
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
    setInterval(updateVisibility, 400);

    const observer = new MutationObserver(() => updateVisibility());
    observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class', 'hidden']
    });

    window.addEventListener('resize', updateVisibility);
    window.addEventListener('popstate', updateVisibility);
    window.addEventListener('hashchange', updateVisibility);

    // Extension popup message listener
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.type === 'TRIGGER_DOWNLOAD') {
            triggerDownload();
            sendResponse({ success: true });
        } else if (request.type === 'CHECK_PDF_STATUS') {
            sendResponse({ isOpen: isPdfOpen() });
        }
    });
})();
