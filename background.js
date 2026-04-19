chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'DOWNLOAD') {
        // Extract the clean filename from the messy URL
        let filename = message.url.split('/').pop().split('?')[0];
        if (!filename.endsWith('.pdf')) filename += '.pdf';

        chrome.downloads.download({
            url: message.url,
            filename: filename,
            conflictAction: 'uniquify'
        });
    }
});