# CONTRIBUTING
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/Alexandro521/Tanko)

# Contributing to Tanko

Thank you for your interest in contributing to the project! Your help is essential to keep improving Tanko.

To keep the codebase organized and make reviewing contributions easier, we ask that you follow these guidelines.

## General Rules

* **Development Branches:** All forks and new branches intended for developing a new feature must originate from the `development` branch (or another branch derived from it). Please **do not use the `master` branch** as the base for your contributions.
* **Atomic Pull Requests:** Pull Requests (PRs) should be precise and focused. Do not group multiple unrelated features or fixes into a single request. It is better to submit several small PRs rather than one large one.

---

##  Where you can contribute

If you're not sure where to start, here are the main areas where we are always looking for improvements:

### 1. Translations (Internationalization)

Help us bring Tanko to more users by translating the application.

* You can create new translation files for your preferred language or update existing ones.
> [!Important]
> Whenever you update or create a language file, you must increment the `lang_version` property within that file.

### 2. Manga Sources (Servers)

Is your trusted manga source not available on Tanko? You can integrate it yourself!

1. Create a new file inside the [`/servers`](https://github.com/Alexandro521/Tanko/blob/master/src/servers) directory with the name you choose for your source.
2. Create a class that implements the [`MangaProvider`](https://github.com/Alexandro521/Tanko/blob/master/src/types/types.d.ts) interface.
3. Register your new class in the [`/server/port.ts`](https://github.com/Alexandro521/Tanko/blob/master/src/servers/port.ts) file. And that's it!

### 3. Reader

The reading experience is the core of the application. If you have ideas on how to optimize it, make it smoother, or add new shortcuts, take a look at the reader engine at:

* [`cli/reader.ts`](https://github.com/Alexandro521/Tanko/blob/master/src/cli/reader.ts)
* [`functions/images.ts`](https://github.com/Alexandro521/Tanko/blob/master/src/functions/images.ts)

### 4. Configuration

If you want to give users more control over the app's behavior, you can implement new configuration options. To do this, you can modify:

* [`/cli/configuration`](https://github.com/Alexandro521/Tanko/blob/master/src/cli/configuration.ts) (for the visual interface options).
* [`/functions/configuration`](https://github.com/Alexandro521/Tanko/blob/master/src/functions/configuration.ts) (for the backend logic handling).

### 5. Terminal User Interface (TUI)

If you feel that any visual section of the TUI could be more intuitive, cleaner, or more attractive, feel free to propose structural or design improvements. You can find the corresponding code by exploring the directory:

* [`/cli`](https://github.com/Alexandro521/Tanko/tree/master/src/cli)

---

We look forward to your contributions!
