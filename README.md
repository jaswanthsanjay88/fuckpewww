# PDF Download Assistant

A lightweight Chrome extension and companion website that shows a floating download button for supported PDF streams.

Repository: https://github.com/jaswanthsanjay88/fuckpewww

## What is included

- `content.js` - injects the page listener and floating download button
- `inject.js` - watches page network activity for supported PDF URLs
- `background.js` - handles the download request
- `popup.html` - small extension status popup
- `index.html` - landing page
- `install.html` - Apple-style installation guide with screenshots
- `assets/images/install/` - organized install screenshots

## Install the extension

1. Download the ZIP from the website.
2. Extract it to a permanent folder on your laptop.
3. Open Chrome, Edge, or Brave and go to `chrome://extensions`.
4. Turn on Developer mode.
5. Click Load unpacked.
6. Select the extracted extension folder.
7. Open the supported learning portal and refresh once.
8. Click the floating download button when it appears.

## Guide page

Open [`install.html`](install.html) for the full screenshot-based installation guide.

## Screenshot organization

All screenshots are stored in `assets/images/install/` and named by step:

- `step-01-open-extensions.png`
- `step-02-load-unpacked.png`
- `step-03-select-folder.png`
- `step-04-extension-installed.png`
- `step-05-open-menu.png`

## Notes

- Keep the extracted folder in place after loading the unpacked extension.
- If the folder moves, remove and reload the extension.
- Use the GitHub repo URL above when sharing or cloning the project.
