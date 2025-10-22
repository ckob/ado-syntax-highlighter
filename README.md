# Syntax Highlighter for Azure DevOps

A browser extension that brings syntax highlighting to file diffs in Azure DevOps, including Pull Requests. Making code reviews easier and more efficient.

## Features

- **Syntax Highlighting:** Automatically applies syntax highlighting to code in pull request diffs.
- **Language Detection:** Detects the programming language based on file extensions.
- **Theme Support:** Seamlessly integrates with both light and dark themes in Azure DevOps.
- **Powered by Prism:** Utilizes the popular [Prism](https://prismjs.com/) library for fast and accurate highlighting.
- **Cross-Browser Support:** Available for both Chrome and Firefox.
- **Custom Domains Support**: Works with self-hosted (on-premise) and other custom Azure DevOps domains via a simple configuration page.

## Screenshots

### Before & After

![Before and After](assets/screenshots/before-after-1280-800.png)

### Side-by-side Diff

![Side-by-side Diff](assets/screenshots/side-by-side-1280-800.png)

### Inline Diff

![Inline Diff](assets/screenshots/inline-1280-800.png)

## Installation

### Chrome

#### From the Chrome Web Store (Recommended)

[Available in the Chrome Web Store](https://chromewebstore.google.com/detail/syntax-highlighter-for-az/lclohacjbfchomeeopaffkedfnbjicdn)

#### From GitHub Releases (Manual)

1.  Go to the [**latest release**](https://github.com/ckob/ado-pr-highlighter/releases/latest).
2.  Download the `chrome-extension.zip` file.
3.  Unzip the file (you will get a folder named `chrome-extension`).
4.  Open Google Chrome and navigate to `chrome://extensions`.
5.  Enable "Developer mode" in the top right corner.
6.  Click "Load unpacked" and select the unzipped `chrome-extension` folder.

### Firefox

#### Manual Installation

1.  Go to the [**latest release**](https://github.com/ckob/ado-pr-highlighter/releases/latest).
2.  Download the `firefox-extension.zip` file.
3.  Unzip the file (you will get a folder named `firefox-extension`)
4.  Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
5.  Click "Load Temporary Add-on".
6.  Navigate to the extension directory and select the `manifest.json` file.

**Note:** This is a temporary add-on and will need to be reloaded every time you restart Firefox.

## Usage

Once installed, the extension will automatically apply syntax highlighting to files in any Azure DevOps pull request you view. There are no additional steps required.

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

### Building from Source

1.  Clone this repository.
2.  Run `make package`. This will build and zip both extensions into the `/dist` directory.
3.  You can then load the unpacked build directories (`dist/chrome_build` and `dist/firefox_build`) into your browser for testing.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.