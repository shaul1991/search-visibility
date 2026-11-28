# Measure public source links in the Gemini web app

[한국어 안내](gemini-app.ko.md)

1. Check availability for your language and country, then start a fresh chat on the web. Keep the prompt, model, account type or sign-in state, device and any connected apps consistent across repeated runs. Record the observed country separately from the prompt locale and save the observation time with its UTC offset. Mobile availability can differ. [Gemini web availability](https://support.google.com/gemini/answer/13575153?hl=en)
2. Save the exact prompt and response. Open **Sources** and inspect inline links in the original response. Put the destination URLs for public web pages shown as sources or related content in `sources`. Exclude private Workspace documents and uploads. Use `sources: []` when you observed an answer without any eligible links. Record unavailable or blocked attempts in a separate log. [Gemini source links](https://support.google.com/gemini/answer/14143489?hl=en)
3. Use `engine: "gemini-web"` and report how many observed answers displayed at least one owned URL out of the total observed answers for each prompt language and observed country. The metric describes displayed links, including related content. Use distinct engine labels for Google Search AI Mode, Gemini API grounding and other surfaces. Apply the [matched comparison procedure](ai-comparison.en.md) when repeating the measurement.

Run this synthetic example from the repository root or use its config with the [single-skill CLI](../README.en.md#run-the-cli-from-a-single-installed-skill).

```sh
npm run visibility -- examples/gemini-app/config.json --out ./gemini-app-sample
```

Expect one answer with an owned link out of two. The Korean prompt has an owned source on an internationalized shared host. The Australian English prompt links to a similarly named account outside the owned path prefix. The UTC offsets place both observations at the same instant across two local dates.
