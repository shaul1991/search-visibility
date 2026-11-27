# Measure visibility in Google AI Overviews and AI Mode

[한국어 안내](google-ai.ko.md)

In Search Console, select your property and open the **Generative AI performance report (Search)**. Google announced worldwide rollout as of August 31, 2026. If the report is missing, check whether the property has enough impressions and whether its Search generative AI control allows inclusion. [Google rollout announcement](https://developers.google.com/search/blog/2026/06/gen-ai-performance-reports) · [Report help](https://support.google.com/webmasters/answer/16984139?hl=en)

| Evidence | What to record |
| --- | --- |
| Search Console Generative AI (Search) | Impressions across AI Overviews and AI Mode. Record the property, period, search type (text-based or multimodal), and any page, country, or device filters. Search Labs experiments are excluded. Use the chart total for the selected scope. Page rows are aggregated by page and their sum can differ from the property total. |
| Search Console Performance (Search results), Web | Web search totals already include the AI-feature traffic covered by the AI report. Keep the existing CSV import for tables with clicks and impressions. Adding the AI impressions to the Web total would double count them. |
| Search Visibility local report | For each surface, count sampled answers with an owned source URL and report the number of sampled answers. Keep the impressions-only AI export in your measurement log. The current CSV import expects both clicks and impressions. |

Search Console uses Pacific Time for dates. Record the date range in PT and use matching filters and complete periods when comparing exports. A report's country is where the search originated. In local observations, `locale` describes the language and locale used for the query. Record the actual search region, device and sign-in state separately. Log attempts where no AI answer appeared. Use `sources: []` for a displayed answer without source links. [Before-and-after comparison](ai-comparison.en.md)

Run the synthetic example from the repository root.

```sh
npm run visibility -- examples/google-ai/config.json --out ./google-ai-sample
```

Expect one owned citation in two answers. The Korean AI Overview cites the Punycode form of `bücher.example`. The Canadian French AI Mode answer cites a different domain. Both observations represent the same instant, November 14 at 00:30 in Seoul and November 13 at 07:30 Pacific Time. Use November 13 when aligning this instant with the corresponding Search Console date. Each surface has only one synthetic answer, so use the results to check input and output. The same config works with the [individually installed skill](../README.en.md#run-the-cli-from-a-single-installed-skill).
