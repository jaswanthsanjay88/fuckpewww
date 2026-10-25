document.addEventListener('DOMContentLoaded', async () => {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const dlBtn = document.getElementById('dlBtn');
    const batchSlidesBtn = document.getElementById('batchSlidesBtn');
    const batchSlidesText = document.getElementById('batchSlidesText');
    const batchNotesBtn = document.getElementById('batchNotesBtn');
    const progressBox = document.getElementById('progressBox');
    const progressBarFill = document.getElementById('progressBarFill');
    const progressMsg = document.getElementById('progressMsg');
    const cancelBatchBtn = document.getElementById('cancelBatchBtn');
    const status = document.getElementById('status');
    const fileCard = document.getElementById('fileCard');
    const fileName = document.getElementById('fileName');

    let currentTabId = null;
    let detectedFilename = 'Parul-Document.pdf';

    function setPdfActive(name, pagination) {
        if (statusDot) statusDot.classList.add('active');
        if (statusText) {
            statusText.textContent = 'PDF Document Active';
            statusText.style.color = '#34D399';
        }
        if (name && fileName && fileCard) {
            detectedFilename = name;
            fileName.textContent = name;
            fileCard.style.display = 'block';
        }
        if (pagination && pagination.total > 1 && batchSlidesText) {
            batchSlidesText.textContent = `⚡ Auto-Download All Slides (${pagination.current} to ${pagination.total})`;
        }
    }

    function setNoPdf() {
        if (statusDot) statusDot.classList.remove('active');
        if (statusText) {
            statusText.textContent = 'No PDF open on page';
            statusText.style.color = '#A8A29E';
        }
        if (fileCard) fileCard.style.display = 'none';
    }

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.id) {
            currentTabId = tab.id;

            chrome.tabs.sendMessage(tab.id, { type: 'CHECK_PDF_STATUS' }, (res) => {
                if (res && res.isOpen) {
                    setPdfActive(res.filename, res.pagination);
                } else {
                    setNoPdf();
                }
            });
        }
    } catch (e) {
        setNoPdf();
    }

    // 1. Single Download
    dlBtn.addEventListener('click', async () => {
        if (status) {
            status.textContent = 'Saving ' + detectedFilename + '...';
            status.style.color = '#38bdf8';
        }

        try {
            if (!currentTabId) {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tab) currentTabId = tab.id;
            }

            if (!currentTabId) return;

            chrome.tabs.sendMessage(currentTabId, {
                type: 'TRIGGER_DOWNLOAD',
                filename: detectedFilename
            }, () => {
                if (status) {
                    status.textContent = 'Downloaded!';
                    status.style.color = '#34D399';
                }
            });
        } catch (err) {}
    });

    // 2. Batch Download Slides (1 to 7)
    batchSlidesBtn.addEventListener('click', async () => {
        if (!currentTabId) return;
        progressBox.style.display = 'block';
        progressBarFill.style.width = '5%';
        progressMsg.textContent = 'Starting slide batch runner...';

        chrome.tabs.sendMessage(currentTabId, { type: 'START_BATCH_SLIDES' });
    });

    // 3. Batch Download Notes / Tutorials
    batchNotesBtn.addEventListener('click', async () => {
        if (!currentTabId) return;
        progressBox.style.display = 'block';
        progressBarFill.style.width = '5%';
        progressMsg.textContent = 'Scanning notes in list...';

        chrome.tabs.sendMessage(currentTabId, { type: 'START_BATCH_NOTES' });
    });

    // 4. Cancel
    cancelBatchBtn.addEventListener('click', () => {
        if (!currentTabId) return;
        chrome.tabs.sendMessage(currentTabId, { type: 'CANCEL_BATCH' });
        progressMsg.textContent = 'Cancelled.';
        setTimeout(() => { progressBox.style.display = 'none'; }, 1000);
    });

    // Listen for progress updates from content.js
    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.type === '__PEWWW_BATCH_PROGRESS__') {
            progressBox.style.display = 'block';
            if (msg.percent !== undefined) {
                progressBarFill.style.width = msg.percent + '%';
            }
            if (msg.text) {
                progressMsg.textContent = msg.text;
            }
            if (msg.done) {
                progressBarFill.style.width = '100%';
                setTimeout(() => { progressBox.style.display = 'none'; }, 3500);
            }
        }
    });
});
