# Compare AI citations before and after a change

[한국어 안내](ai-comparison.ko.md)

1. Before changing your site, save the exact prompts and a sampling plan. Use the same engine, product surface, search mode, model when known, location, language, and number of attempts in each period. Start each attempt in a fresh conversation and keep account and personalization settings consistent where you can. Record the collection window and time zone. Location can affect results even when the prompt text stays the same. [ChatGPT search documentation](https://help.openai.com/en/articles/9237897-searching-the-web-with-chatgpt)
2. Collect again after the change. Keep `brand`, `aliases`, `domains`, and `ownedUrlPrefixes` the same when scoring both periods. Record each returned answer and its displayed source URLs. Use `sources: []` when a returned answer has no sources. Log failed attempts separately and compare the same completed prompt and repeat slots. Report the missing slots alongside the comparison.
3. Compare each engine, search mode, and market separately. Use `locale` for the observation language and keep market and search mode in your collection notes. The CLI groups summaries by engine only, so use separate configs per market and mode for separate totals, or inspect `ai.records` by prompt and locale. Report answer counts alongside rates. Changes in the sample describe the observed answers and cannot establish what caused them.

## Run a synthetic example

From the repository root, with Node.js 18 or later, use two new output directories.

```sh
npm run visibility -- examples/ai-comparison/before.config.json --out ./ai-before
npm run visibility -- examples/ai-comparison/after.config.json --out ./ai-after
npm run visibility -- compare ./ai-before/report.json ./ai-after/report.json --out ./ai-diff --lang en
```

Open `ai-diff/index.html` or read `ai-diff/report.json` for before, after, and after-minus-before values. JSON rates use fractions (a delta of `0.5` is +50 percentage points). Missing measurements yield a null delta. Site deltas require the same targets and complete audits. Search Console deltas require the same CSV dimension.

Open each `index.html` for the summary and inspect `ai.records` in each `report.json` for the matched answers. Both runs have two answers and two brand mentions. Owned citations rise from 1/2 to 2/2, a change of 50 percentage points. The Korean prompt goes from no citation to an owned citation. The English prompt cites the owned host in both runs. The inputs demonstrate UTF-8 questions, a Unicode hostname normalized to ASCII in the report, and timestamps with explicit UTC offsets for Seoul and New York.

Google Search Console's Web search totals include traffic from AI Overviews and AI Mode. Keep those traffic metrics separate from the answer-level citation rates in this example. [Google Search Central documentation](https://developers.google.com/search/docs/appearance/ai-features)
