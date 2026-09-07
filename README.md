# Fcuk-Pewww - Parul PDF Downloader ⚡

A high-performance Manifest V3 Chrome extension designed specifically for Parul University eLearning (`elearning.paruluniversity.ac.in`).

Seamlessly downloads protected and streamed course materials and lecture slides rendered via Angular and `ngx-extended-pdf-viewer` (PDF.js).

Repository: https://github.com/jaswanthsanjay88/fuckpewww

---

## ✨ Features (v2.5)

- 🎨 **Claude UI/UX Pro Max Floating Capsule**: Single, minimalist warm charcoal pill (`#1A1917`) with glassmorphism blur, terracotta accent (`#D97757`), and spring animations.
- 👁️ **Smart Dynamic Visibility**:
  - Automatically hidden on dashboards, course lists, and non-PDF pages.
  - Automatically slides in when a PDF document or modal is opened.
  - Automatically hides when the document is closed or navigated away.
- ⚡ **Direct Native Execution**: Invokes `window.PDFViewerApplication.downloadOrSave()` in the page's MAIN world via background service worker scripting (100% immune to Content Security Policy).
- ⌨️ **Keyboard Shortcuts**: Press **`Ctrl + S`** (or **`Alt + D`**) anywhere on the page or inside embedded PDF viewers to instantly download.
- 🔒 **Global Debounce Lock**: Strict 2.5-second debounce ensures files are downloaded **exactly once** per click/shortcut without duplicate triggers.
- 📌 **Live Status Popup**: Extension toolbar popup with live detection dot indicating whether a PDF document is currently open on the active tab.

---

## 📦 What Is Included

- `content.js` - DOM observer, dynamic capsule lifecycle, shortcut capture, and iframe coordination.
- `inject.js` - Web-accessible helper for page context PDF viewer execution.
- `background.js` - Service worker executing MAIN-world `downloadOrSave()` bypassing web page CSP.
- `popup.html` & `popup.js` - Claude-styled toolbar extension popup with live document detection.
- `manifest.json` - Manifest V3 configuration.
- `index.html` & `install.html` - Installation guide and companion web pages.

---

## 🚀 Installation Guide

1. Download the latest **`fcuk-pewww-parul-downloader-v2.5.zip`** from [GitHub Releases](https://github.com/jaswanthsanjay88/fuckpewww/releases).
2. Extract the ZIP to a permanent folder on your computer.
3. Open Google Chrome (or Edge/Brave) and navigate to `chrome://extensions`.
4. Enable **Developer mode** using the toggle switch in the top right corner.
5. Click **Load unpacked** in the top left corner.
6. Select the extracted folder.
7. Open `elearning.paruluniversity.ac.in` and refresh (`Ctrl + Shift + R`).
8. When you open any lecture material, the download capsule will appear at the bottom-right!

---

## ⌨️ Shortcuts

| Shortcut | Action | Scope |
| :--- | :--- | :--- |
| `Ctrl + S` / `Cmd + S` | Download PDF Document | Active when PDF is open |
| `Alt + D` | Alternative Download Trigger | Active when PDF is open |

---

## 📜 License

MIT License. Designed for Parul University students.
