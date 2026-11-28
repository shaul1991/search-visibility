# Measure citations in Perplexity Search

[한국어 안내](perplexity-search.ko.md)

1. Open a fresh session on Perplexity and select **Search**. Perplexity describes core search as free. Its help center says Search can use Pro Search automatically depending on your plan and remaining allowance. Record the selected search mode, model setting (including **Best**), plan or sign-in state, device, query language, observed region and time with its UTC offset. Use matched settings and fresh sessions for [before-and-after comparisons](ai-comparison.en.md). [Perplexity product overview](https://www.perplexity.ai/hub) · [Perplexity Search help](https://www.perplexity.ai/help-center/en/articles/10352903-what-is-pro-search)
2. Save the exact prompt and answer body. Open the citations shown in the answer and put the destination URLs in `sources`. Use `sources: []` for an observed answer with no citations. Log blocked attempts or missing answers outside the dataset. Use a consistent engine label such as `perplexity-search` and keep Deep Research or API runs in separate groups.
3. Report how many observed answers cited at least one owned URL, alongside the total observed answers in each language and region. Keep the actual region in your measurement log. In the JSON, `locale` labels the prompt language and locale.

If you are checking whether your page can be surfaced, Perplexity documents `PerplexityBot` for search and recommends allowing its published IP ranges. A crawler visit measures access. An answer citation measures visibility in the sampled answer. [Perplexity crawler documentation](https://docs.perplexity.ai/docs/resources/perplexity-crawlers)

Run the synthetic example from the repository root.

```sh
npm run visibility -- examples/perplexity-search/config.json --out ./perplexity-search-sample
```

Expect one answer with an owned citation out of two observed answers. The Korean prompt's source uses Punycode and an encoded Korean account path. The Canadian English prompt's source belongs to a different account on the same host. Both observations represent the same instant with different local dates. You can also run the config from a [single installed skill](../README.en.md#run-the-cli-from-a-single-installed-skill).
