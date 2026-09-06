# Tanko 
![NPM Downloads](https://img.shields.io/npm/dw/tanko?style=for-the-badge)
![GitHub Repo stars](https://img.shields.io/github/stars/Alexandro521/Tanko?style=for-the-badge)
[![npm version](https://img.shields.io/npm/v/tanko.svg?style=for-the-badge)](https://www.npmjs.com/package/tanko)
![GitHub Issues or Pull Requests](https://img.shields.io/github/issues/Alexandro521/Tanko?style=for-the-badge)
![GitHub Issues or Pull Requests](https://img.shields.io/github/issues-pr/Alexandro521/Tanko?style=for-the-badge)
[![license](https://img.shields.io/npm/l/tanko.svg?style=for-the-badge)](https://github.com/Alexandro521/tanko/LICENSE)
---
Tanko is a CLI tool for reading and downloading manga directly from your terminal.

![yomu preview](https://i.imgur.com/wftXbEC.png)
![yomu preview](https://i.imgur.com/E7hiBhG.jpeg)

## Features
- Download chapters in `PDF`, `ZIP`, `CBZ`, and individual image formats
- Local reading history
- Local reading progress tracking
- Basic integration with Anilist (WIP)
- Support for graphics protocols: `Kitty`, `Sixel`, `iTerm2`, and ASCII rendering
- Available languages:
    - `Spanish`
    - `English`
    - `French` by [Penicilline28](https://github.com/Penicilline28)
### Available sources (WIP)
|Name| Status | Language | Requires a browser | Official site
|--|---|---|---|---
| `mangadex` |Good | Multiple | No|[mangadex.org](https://mangadex.org/)
| `leercapitulo` | Bad | Spanish | Yes|[leercapitulo.co](https://www.leercapitulo.co/)

## Install Tanko

### Using pnpm / npm

```bash
pnpm install -g tanko
```
##  Install a Browser

> [!NOTE]
> Some sources require a web browser to scrape manga, but this step is not mandatory; you can use Tanko with sources that do not require a browser.
```bash
#firefox
npx playwright install firefox
#chromium
npx playwright install chromium
#webkit
npx playwright install webkit
#Running the command without arguments will install the default browsers
npx playwright install
```
### Install dependencies required to run the browser

System dependencies can get installed automatically. This is useful for CI environments.
```bash
npx playwright install-deps
```
You can also install the dependencies for a single browser by passing it as an argument:
```bash
npx playwright install-deps chromium
```
It's also possible to combine install-deps with install so that the browsers and OS dependencies are installed with a single command.
```bash
npx playwright install --with-deps chromium
```

See [system requirements](https://playwright.dev/docs/intro#system-requirements) for officially supported operating systems.

[Playwright documentation](https://playwright.dev/docs/browsers)

## Run Tanko

```bash
tanko
```

> [!NOTE]
> **Download Directory:** Downloaded chapters are currently saved in `$HOME/tanko/downloads/`.
> On Windows, it uses the `USERPROFILE` environment variable if defined. Otherwise, it defaults to the path of the current user's profile directory.


### Recommended Terminals
> [!NOTE]
> **Visual Experience:** To enjoy reading manga with real, high-quality images, we highly recommend using a terminal emulator that supports modern image protocols.

For an optimal experience with high-resolution images, use one of the following terminals:

| Emulator | Supported Image Protocols | Platforms | Download |
| --- | --- | --- | --- |
| **Kitty** | Kitty Graphics Protocol | Linux, macOS | [Download](https://sw.kovidgoyal.net/kitty/binary/) |
| **WezTerm** | Kitty, iTerm2, Sixel | Linux, macOS, Windows | [Download](https://wezterm.org/installation.html) |
| **iTerm2** | iTerm2 Inline Image Protocol, Sixel | macOS | [Download](https://iterm2.com/downloads.html) |
| **Ghostty** | Kitty Graphics Protocol | Linux, macOS | [Download](https://ghostty.org/download) |
| **Foot** | Sixel | Linux (Wayland) | [Download](https://codeberg.org/dnkl/foot/releases) |
| **Konsole** | Sixel, iTerm2 | Linux | [Download](https://apps.kde.org/konsole/) |
| **Xterm** | Sixel | Linux, macOS | [Download](https://www.google.com/search?q=https://invisible-island.net/xterm/%23download) |
| **mlterm** | Sixel, Jtterm | Linux, Windows | [Download](https://sourceforge.net/projects/mlterm/files/) |
| **Contour** | Sixel | Linux, macOS, Windows | [Download](https://github.com/contour-terminal/contour/releases) |
| **Rio** | Kitty, iTerm2 | Linux, macOS, Windows, FreeBSD | [Download](https://rioterm.com/docs/install) |

>[!NOTE]
 In standard or basic terminals (such as Windows CMD or the VS Code integrated terminal), images will fallback and render as **ASCII Art**.
