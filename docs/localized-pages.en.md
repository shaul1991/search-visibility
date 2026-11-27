# Check localized pages before publishing

[한국어 안내](localized-pages.ko.md)

1. Give each version a stable URL and put the main content in the intended language. Link to the other versions so people and crawlers can reach them directly. Keep the URLs accessible without automatic redirects based on IP address or browser language. [Google's guidance for multilingual sites](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites)
2. Give each distinct version that you want indexed its own canonical URL. For duplicate pages in the same language, decide which URL should be canonical before adding regional annotations. Point to a canonical in the same language when available. [Google's canonical guidance](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
3. In each page's HTML head, list the alternate versions with absolute URLs. Include the page itself and check that every listed version links back. Use `ko` for Korean, `en-CA` for English in Canada and `en` for English without a country restriction. The optional `x-default` marks the fallback URL. [Google's hreflang guidance](https://developers.google.com/search/docs/specialty/international/localized-versions)

Run the [synthetic example](../examples/localized-pages/config.json) from the repository root.

```sh
npm run visibility -- examples/localized-pages/config.json
```

With the [individually installed SEO Orchestrator skill](../README.en.md#run-the-cli-from-a-single-installed-skill), pass the same config path to the installed `visibility.mjs`. The report should audit three local pages. Each page declares a canonical on the synthetic internationalized host `bücher.example` (ASCII form `xn--bcher-kva.example`). In `report.json`, expect no canonical or noindex finding for these pages. The minimal HTML can still produce sharing-card findings. Compare the `hreflang` mappings in the three HTML files manually to verify their self-links and return links.

After deployment, replace the config targets with the public URLs and rerun the check to include redirects, HTTP headers and robots.txt. Use the URL Inspection tool in Google Search Console to check Google's indexing state and selected canonical. The `hreflang` steps describe Google Search behavior. Use the [Korean search guide](korea-search.en.md) to check visibility in Naver and Daum separately.
