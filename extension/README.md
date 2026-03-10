# Token Shop – CV Extractor (Chrome Extension)

A Chrome extension that extracts text from a configurable CSS selector on any page so you can use the content for your CV.

## File Tree

```
extension/
├── manifest.json   # Extension manifest (MV3)
├── config.js       # TARGET_SELECTOR constant
├── content.js      # Content script – reads the DOM
├── popup.html      # Popup UI
├── popup.css       # Popup styles
├── popup.js        # Popup logic – sends extract message
└── README.md
```

## Configuration

Open **config.js** and change `TARGET_SELECTOR` to the CSS selector of the element you want to extract text from:

```js
const TARGET_SELECTOR = ".job-description"; // default
```

## Install & Run

1. Clone / download this repository.
2. Open **chrome://extensions** in Google Chrome.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** and select the `extension/` folder.
5. Navigate to any page that contains an element matching the selector in `config.js`.
6. Click the extension icon in the toolbar and press **Extract**.
7. The extracted text will appear inside the popup.

> **Note:** If you change `config.js` after loading the extension, click the reload button on the extension card in `chrome://extensions` and refresh the target page.