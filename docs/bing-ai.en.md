# Measure AI citations in Bing and Copilot

[한국어 안내](bing-ai.ko.md)

For a site you can access in Bing Webmaster Tools, open **AI Performance**. Record the site, date range, filters and capture date. Use **Compare** to compare date ranges within that site. Keep periods of equal length and use the same filters. Microsoft's preview covers Microsoft Copilot, Bing AI summaries and select partner experiences. [AI Performance metrics](https://blogs.bing.com/webmaster/2026/2/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview/) · [Compare and Citation Share](https://blogs.bing.com/search/2026/6/New-AI-Visibility-Insights-in-Bing-Webmaster-Tools-Intents-Topics-Citation-Share-Compare/)

| Evidence | What it measures |
| --- | --- |
| Total Citations | Source citations across the supported experiences during the selected period. |
| Citation Share | Your site's share of all citations for a specific grounding query. Grounding queries are retrieval phrases used by the system, and the report shows a sample. |
| Local CLI citation rate | Observed answers with at least one owned source URL divided by the number of answers you collected. |

Keep these metrics in separate columns and retain the denominator for each rate. For a market-level check, collect answers yourself. Record the exact prompt, interface, language, access region, sign-in state and observation time with its offset. Keep Copilot and Bing AI summaries in separate groups. Give each language and market its own set of prompts and repeat the same prompts under the same conditions when comparing periods. Keep attempts that yielded no answer in your collection log. Use `sources: []` when an answer appeared without any visible source links. [Before-and-after comparison](ai-comparison.en.md)

Run this synthetic example offline from the repository root.

```sh
npm run visibility -- examples/bing-ai/config.json --out ./bing-ai-sample
```

In `report.json`, expect one cited answer out of two. The Korean answer cites the Punycode form of `bücher.example`. The Canadian English answer has no source links. Both records represent the same instant, November 1 in Korea and October 31 in Pacific Canada. Keep each record's local date when grouping by market. With only one answer per locale, use the numbers to verify the input and output format. You can use the same config with the [individually installed skill](../README.en.md#run-the-cli-from-a-single-installed-skill).
