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

    const showDownloadButton = (url) => {
        if (!url) return;
        currentPdfUrl = url;

        let btn = document.getElementById('stealth-dl-btn');

        if (!btn) {
            btn = document.createElement('button');
            btn.id = 'stealth-dl-btn';
            btn.title = 'Download PDF';
            btn.style.cssText = BUTTON_STYLE;
            
            btn.onmouseover = () => {
                btn.style.backgroundColor = '#333333';
                btn.style.transform = 'scale(1.1)';
            };
            btn.onmouseout = () => {
                btn.style.backgroundColor = '#000000';
                btn.style.transform = 'scale(1)';
            };
            document.body.appendChild(btn);
        }

        btn.innerHTML = DOWNLOAD_ICON;
        btn.style.display = 'flex';
        
        btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!currentPdfUrl) return;

            chrome.runtime.sendMessage({ type: 'DOWNLOAD', url: currentPdfUrl }, () => {
                if (chrome.runtime.lastError) return;
                
                btn.innerHTML = CHECK_ICON;
                btn.style.borderColor = '#4ade80';
                setTimeout(() => {
                    btn.innerHTML = DOWNLOAD_ICON;
                    btn.style.borderColor = '#ffffff';
                }, 2000);
            });
        };
    };

    const scanDOMForPDFs = () => {
        const isPdfUrl = (url) => {
            if (typeof url !== 'string') return false;
            const lower = url.toLowerCase();
            return (lower.includes('storage.googleapis.com') || lower.includes('amazonaws.com')) && 
                   lower.includes('.pdf') &&
                   !lower.includes('api.paruluniversity.ac.in');
        };

        document.querySelectorAll('iframe').forEach(el => {
            try {
                if (el.src && isPdfUrl(el.src)) showDownloadButton(el.src);
            } catch (e) {}
        });

        document.querySelectorAll('embed').forEach(el => {
            try {
                if (el.src && isPdfUrl(el.src)) showDownloadButton(el.src);
            } catch (e) {}
        });

        document.querySelectorAll('object').forEach(el => {
            try {
                if (el.data && isPdfUrl(el.data)) showDownloadButton(el.data);
            } catch (e) {}
        });

        document.querySelectorAll('a').forEach(el => {
            try {
                if (el.href && isPdfUrl(el.href)) showDownloadButton(el.href);
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
        if (e.source !== window || !e.data) {
            return;
        }
        if (
            e.data.type === 'PDF_URL_FOUND' &&
            e.data.k === token &&
            typeof e.data.url === 'string'
        ) {
            showDownloadButton(e.data.url);
        }
    });

    scanDOMForPDFs();
    setInterval(scanDOMForPDFs, 1500);

    const observer = new MutationObserver(() => {
        scanDOMForPDFs();
    });
    observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['src', 'data', 'href']
    });

})();