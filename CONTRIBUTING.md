## Contributions are welcome

### How do I implement my own manga supplier?
How do I set up my own manga supplier?

1. **Basic:**
Create a file, preferably named after the provider, and create a class implementing the `MangaProvider` interface.

1. **Page argument:**
You can receive a Page object from Playwright through the constructor if your provider needs a browser to obtain manga. If possible, avoid using this and use scraping via HTTP.

3. **Scraping with Cheerio:**
Use `Cheerio` for scraping via HTTP. I recommend using this option whenever possible. Even if your provider requires a browser for certain parts, you can opt for a hybrid approach where you use Cheerio for the parts that don't.

How you implement the different methods isn't really important. You can use any methods you want to obtain the data. You also don't need to handle errors; any errors will be caught by the invoker and displayed as an on-screen notification.

### Temporary rules:
These rules are temporary restrictions that will disappear in future versions.

1. Currently, and until this rule is removed from this document, the list of The chapters returned by the `getChapterList` method must be sorted in descending order, why? Poor application design; there's a utility called `sortChapterList` that does this job.

2. The chapter title format must include the chapter number: e.g., `chapter 10: blah blah blah`. This is usually included by default in the provider's data, but it's important to emphasize it.

### Special patches
Your provider may require specific patches in some parts of the application to function correctly. Don't hesitate to apply them.

### Enabling
Once your provider is working, it's time to register it so it can be used. Follow these steps:

1. Define a public property `name` with the name of your provider. You must also add it to the Union type `ServerName`.

2. In `Servers/port.ts`, create a new entry for your provider. Use the other entries in the list as examples.

And that's all that's needed to create a manga provider. Use the existing examples for better understanding.
