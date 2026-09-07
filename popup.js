document.addEventListener('DOMContentLoaded', async () => {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const dlBtn = document.getElementById('dlBtn');
    const status = document.getElementById('status');

    let currentTabId = null;

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.id) {
            currentTabId = tab.id;
            chrome.tabs.sendMessage(tab.id, { type: 'CHECK_PDF_STATUS' }, (res) => {
                if (chrome.runtime.lastError || !res) {
                    statusText.textContent = 'No PDF open on page';
                    return;
                }
                if (res.isOpen) {
                    statusDot.classList.add('active');
                    statusText.textContent = 'PDF Document Active';
                    statusText.style.color = '#34D399';
                } else {
                    statusText.textContent = 'No PDF open on page';
                }
            });
        }
    } catch (e) {
        statusText.textContent = 'No PDF open on page';
    }

    dlBtn.addEventListener('click', async () => {
        status.textContent = 'Downloading...';
        status.style.color = '#38bdf8';

        try {
            if (!currentTabId) {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tab) currentTabId = tab.id;
            }

            if (!currentTabId) {
                status.textContent = 'No active tab.';
                return;
            }

            // Single coordinated download via background service worker
            chrome.runtime.sendMessage({
                type: 'TRIGGER_SINGLE_DOWNLOAD',
                tabId: currentTabId
            }, (res) => {
                status.textContent = 'Download started!';
                status.style.color = '#34D399';
            });

            // Also trigger toast in content script
            chrome.tabs.sendMessage(currentTabId, { type: 'TRIGGER_DOWNLOAD' });
        } catch (err) {
            status.textContent = 'Download triggered!';
            status.style.color = '#34D399';
        }
    });
});
