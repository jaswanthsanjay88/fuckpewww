document.addEventListener('DOMContentLoaded', async () => {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const dlBtn = document.getElementById('dlBtn');
    const status = document.getElementById('status');

    let currentTabId = null;

    function setPdfActive() {
        if (statusDot) statusDot.classList.add('active');
        if (statusText) {
            statusText.textContent = 'PDF Document Active';
            statusText.style.color = '#34D399';
        }
    }

    function setNoPdf() {
        if (statusDot) statusDot.classList.remove('active');
        if (statusText) {
            statusText.textContent = 'No PDF open on page';
            statusText.style.color = '#A8A29E';
        }
    }

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.id) {
            currentTabId = tab.id;

            chrome.tabs.sendMessage(tab.id, { type: 'CHECK_PDF_STATUS' }, async (res) => {
                if (res && res.isOpen) {
                    setPdfActive();
                    return;
                }

                try {
                    const results = await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        func: () => {
                            const selectors = [
                                'pdf-viewer',
                                'ngx-extended-pdf-viewer',
                                '.ng2-pdf-viewer-container',
                                '#viewerContainer',
                                '.pdfViewer',
                                'canvas'
                            ];
                            for (const s of selectors) {
                                const el = document.querySelector(s);
                                if (el) return true;
                            }
                            const url = window.location.href.toLowerCase();
                            return url.includes('classrooms') || url.includes('subjects') || url.includes('elearning');
                        }
                    });
                    if (results && results[0] && results[0].result) {
                        setPdfActive();
                    } else {
                        setNoPdf();
                    }
                } catch (e) {
                    if (tab.url && (tab.url.includes('paruluniversity') || tab.url.includes('classrooms'))) {
                        setPdfActive();
                    } else {
                        setNoPdf();
                    }
                }
            });
        }
    } catch (e) {
        setNoPdf();
    }

    dlBtn.addEventListener('click', async () => {
        if (status) {
            status.textContent = 'Downloading...';
            status.style.color = '#38bdf8';
        }

        try {
            if (!currentTabId) {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tab) currentTabId = tab.id;
            }

            if (!currentTabId) {
                if (status) status.textContent = 'No active tab.';
                return;
            }

            chrome.runtime.sendMessage({
                type: 'TRIGGER_SINGLE_DOWNLOAD',
                tabId: currentTabId
            }, () => {
                if (status) {
                    status.textContent = 'Download started!';
                    status.style.color = '#34D399';
                }
            });

            chrome.tabs.sendMessage(currentTabId, { type: 'TRIGGER_DOWNLOAD' }, () => {});
        } catch (err) {
            if (status) {
                status.textContent = 'Download triggered!';
                status.style.color = '#34D399';
            }
        }
    });
});
