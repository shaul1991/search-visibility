# Measure visibility in Korean search

[한국어 안내](korea-search.ko.md)

| Surface | What to record |
| --- | --- |
| Naver web search | For a verified site, record clicks, impressions, the displayed date range and device filter in Search Advisor. Its web search scope excludes areas such as VIEW, blog results and ads. Check the report's update date before comparing periods. [Naver Search Advisor](https://searchadvisor.naver.com/guide/report-expose-ctr) |
| Daum web search | For a site you manage, use the free Webmaster Tools Beta search report for web document clicks and impressions. Keep crawl and index counts in their own columns. [Daum Help](https://cs.daum.net/faq/service/15/category/4118/detail/38325) |
| Naver AI Briefing | Record whether a briefing appeared and copy the visible answer and its source URLs. Treat AI Tab conversations as a separate surface. [AI Briefing](https://help.naver.com/service/5626/contents/24119) · [AI Tab](https://help.naver.com/service/5626/contents/25122?lang=ko&osType=COMMONOS) |

Run the same Korean query on the public Naver and Daum search pages. For each surface, record the exact query, access region, device, session or sign-in state and observation time with an offset such as `+09:00`. For ordinary results, record the result section and the matching URL if visible. Compare the same device, region and surface over time. Keep webmaster totals in a separate log from the CLI's Google Search Console CSV input.

For AI Briefing, use `engine: "naver-ai-briefing"` and `locale: "ko-KR"` for an answer observed in Korean for the Korean market. Keep the actual access region in your collection log. Save attempts without a briefing or with a load error in that log. Use `sources: []` when a briefing was visible and displayed no links. Report both briefing appearances per attempt and answers citing an owned URL per observed briefing. Keep any native profile citation totals in a separate column, with their reporting period. [Naver profile citation counts](https://help.naver.com/service/30056/contents/25217?lang=ko&osType=COMMONOS)

From the repository root, use a fresh output directory to run this synthetic sample offline.

```sh
npm run visibility -- examples/korea-search/naver-ai-briefing.config.json --out ./naver-briefing-sample
```

In `report.json`, expect two brand mentions and one owned citation across two answers (50%). The Korean domain is normalized and the similar-looking Naver Blog account is outside the configured account path. The first observation is November 1 in Korea and October 31 in UTC. Use the recorded offset when assigning observations to local reporting dates. For a before-and-after study, follow the matching procedure. [Before-and-after guide](ai-comparison.en.md)
