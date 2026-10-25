document.addEventListener('DOMContentLoaded', async () => {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const dlBtn = document.getElementById('dlBtn');
    const status = document.getElementById('status');
    const fileCard = document.getElementById('fileCard');
    const fileName = document.getElementById('fileName');

    let currentTabId = null;
    let detectedFilename = 'Parul-Document.pdf';

    function setPdfActive(name) {
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
    }

    function setNoPdf() {
        if (statusDot) statusDot.classList.remove('active');
        if (statusText) {
            statusText.textContent = 'No PDF open on page';
            statusText.style.color = '#A8A29E';
        }
        if (fileCard) {
            fileCard.style.display = 'none';
        }
    }

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.id) {
            currentTabId = tab.id;

            chrome.tabs.sendMessage(tab.id, { type: 'CHECK_PDF_STATUS' }, async (res) => {
                if (res && res.isOpen) {
                    setPdfActive(res.filename);
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
                            let hasEl = false;
                            for (const s of selectors) {
                                if (document.querySelector(s)) {
                                    hasEl = true;
                                    break;
                                }
                            }
                            const url = window.location.href.toLowerCase();
                            const isEduUrl = url.includes('classrooms') || url.includes('subjects') || url.includes('elearning');

                            let foundName = '';
                            const elements = Array.from(document.querySelectorAll('span, div, h1, h2, h3, h4, p, b, strong, a'));
                            for (let i = 0; i < elements.length; i++) {
                                const txt = elements[i].innerText ? elements[i].innerText.trim() : '';
                                if (txt.match(/^(UNIT|Chapter|Lecture|Tutorial|Assignment)\s*[-_]?\s*\d+/i)) {
                                    foundName = txt.replace(/[\\/:*?"<>|]/g, '-').trim() + '.pdf';
                                    break;
                                }
                            }

                            return { isOpen: hasEl || isEduUrl, name: foundName };
                        }
                    });

                    if (results && results[0] && results[0].result && results[0].result.isOpen) {
                        setPdfActive(results[0].result.name);
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
            status.textContent = 'Saving ' + detectedFilename + '...';
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
                tabId: currentTabId,
                filename: detectedFilename
            }, () => {
                if (status) {
                    status.textContent = 'Downloaded!';
                    status.style.color = '#34D399';
                }
            });

            chrome.tabs.sendMessage(currentTabId, {
                type: 'TRIGGER_DOWNLOAD',
                filename: detectedFilename
            }, () => {});
        } catch (err) {
            if (status) {
                status.textContent = 'Download triggered!';
                status.style.color = '#34D399';
            }
        }
    });
});
