# Tanko

[![npm version](https://img.shields.io/npm/v/tanko.svg)](https://www.npmjs.com/package/tanko)
[![license](https://img.shields.io/npm/l/tanko.svg)](https://github.com/Alexandro521/tanko/LICENSE)
[![Publish to NPM](https://github.com/Alexandro521/Tanko/actions/workflows/npm-publish.yml/badge.svg)](https://github.com/Alexandro521/Tanko/actions/workflows/npm-publish.yml)

Tanko is a CLI tool for reading and downloading manga directly from your terminal.

![yomu preview](https://i.imgur.com/wftXbEC.png)
![yomu preview](https://i.imgur.com/Gu2sYF2.png)

## 1. Install Tanko

### Using pnpm / npm

```bash
pnpm install -g tanko
```

> [!NOTE]
> Some sources require a web browser to scrape manga, but this step is not mandatory; you can use Tanko with sources that do not require a browser.
### 2. Install the Firefox Browser
```bash
npx playwright install firefox

```

### 3. Run Tanko

```bash
tanko

```

> [!IMPORTANT]
> **Download Directory:** Downloaded chapters are currently saved in `$HOME/tanko/downloads/`.
> On Windows, it uses the `USERPROFILE` environment variable if defined. Otherwise, it defaults to the path of the current user's profile directory.

> [!IMPORTANT]
> **Visual Experience:** To enjoy reading manga with real, high-quality images, we highly recommend using a terminal emulator that supports modern image protocols.

### 🚀 Recommended Terminals

For an optimal experience with high-resolution images, use one of the following terminals:

| Terminal | Operating System | Supported Protocol | Link |
| --- | --- | --- | --- |
| **Kitty** | Linux / macOS | Kitty Graphics | [Download](https://sw.kovidgoyal.net/kitty/) |
| **Ghostty** | macOS / Linux | Kitty Graphics | [Download](https://ghostty.org/) |
| **WezTerm** | Win / Mac / Linux | Kitty / Sixel | [Download](https://wezfurlong.org/wezterm/) |

> **Note:** In standard or basic terminals (such as Windows CMD or the VS Code integrated terminal), images will fallback and render as **ASCII Art**.

---

## Features

* [X] Read chapters directly in the terminal
* [X] Download chapters in PDF format
* [X] Reading history
* [ ] Download multiple chapters simultaneously
* [X] Settings and configuration menu
* [ ] Deep search capabilities
* [X] Multiple servers/sources support
* [X] Notifications
* [ ] Favorites section
