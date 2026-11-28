# Measure visibility in ChatGPT Search

[한국어 안내](chatgpt-search.ko.md)

1. In a fresh chat on chatgpt.com, select **+ → Web search** and send your prompt. Record the exact prompt, locale, region, device, sign-in state, location and memory settings, and time with a UTC offset. Compare runs under matching conditions. ChatGPT can use approximate IP location, optional device location and saved context in search. If a plan limit or workspace setting prevents a search, record the attempt separately. [OpenAI Search help](https://help.openai.com/en/articles/9237897-searching-the-web-with-chatgpt)
2. Copy the answer body and the URLs it directly cites. **View sources** can show both citations and other relevant links. Check the inline citations before copying URLs to `sources`. Use `sources: []` when a search answer displayed no citations. Give these observations the same `engine`, such as `chatgpt-search`. [Before-and-after comparison](ai-comparison.en.md)
3. Report owned citations per observed answer, with the denominator. To measure visits separately, use your own analytics and check whether the landing URL or session source contains a ChatGPT signal, such as `utm_source=chatgpt.com` when present. Record the analytics timezone, date range and attribution filter. An observed citation measures visibility in the sample. A recorded session measures attributed traffic to the site.

For crawl eligibility, check the target page's robots.txt rules for `OAI-SearchBot` and allow requests from its published IP ranges at the CDN or host. OpenAI documents separate controls for search and model training (`GPTBot`). Eligibility gives the page a chance to appear. [OpenAI crawler documentation](https://developers.openai.com/api/docs/bots)

Run the synthetic example from the repository root.

```sh
npm run visibility -- examples/chatgpt-search/config.json --out ./chatgpt-search-sample
```

Expect one owned citation in two answers. The Korean answer links to a Punycode hostname and a percent-encoded path with a sample tracking parameter. The English answer links to a neighboring account on the same shared host. Both timestamps describe the same instant, with different local calendar dates. Keep `locale` for the prompt language and record the actual search region in your measurement log. The same config works with the [individually installed skill](../README.en.md#run-the-cli-from-a-single-installed-skill).
