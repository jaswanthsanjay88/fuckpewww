chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'DOWNLOAD' && message.url) {
        let filename = message.filename;
        if (!filename) {
            filename = message.url.split('/').pop().split('?')[0];
        }
        if (!filename) filename = 'parul-document.pdf';
        filename = filename.replace(/[\\/:*?"<>|]/g, '-').trim();
        if (!filename.toLowerCase().endsWith('.pdf')) filename += '.pdf';

        chrome.downloads.download({
            url: message.url,
            filename: filename,
            conflictAction: 'uniquify'
        });
    }
});
