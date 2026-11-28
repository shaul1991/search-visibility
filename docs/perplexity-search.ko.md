# Perplexity 검색 인용 측정

[English guide](perplexity-search.en.md)

1. Perplexity에서 새 세션을 열고 **Search**를 선택합니다. Perplexity는 기본 검색을 무료로 제공한다고 안내합니다. 도움말에 따르면 요금제와 남은 한도에 따라 Search에서 Pro Search가 자동 적용될 수 있습니다. 검색 모드, 모델 설정(**Best** 포함), 요금제 또는 로그인 상태, 기기, 질문 언어, 관측 지역, UTC 오프셋을 포함한 시각을 기록합니다. [전후 비교](ai-comparison.ko.md)에서는 같은 조건으로 매번 새 세션에서 질의합니다. [Perplexity 제품 안내](https://www.perplexity.ai/hub) · [Perplexity 검색 도움말](https://www.perplexity.ai/help-center/en/articles/10352903-what-is-pro-search)
2. 질문 원문과 답변 본문을 저장합니다. 답변에 표시된 인용을 열어 연결된 페이지 URL을 `sources`에 넣습니다. 인용 없이 답변이 표시되면 `sources: []`로 기록합니다. 검색이 차단됐거나 답변을 확보하지 못한 시도는 별도 기록합니다. 엔진은 `perplexity-search`처럼 일관되게 표기하고, Deep Research와 API 결과는 별도 그룹으로 집계합니다.
3. 언어와 지역별로 전체 관측 답변 수와 소유 URL을 하나 이상 인용한 답변 수를 함께 보고합니다. 실제 관측 지역은 측정 기록에 남깁니다. JSON의 `locale`은 질문의 언어와 로캘을 나타냅니다.

페이지의 검색 노출 가능성을 점검할 때는 Perplexity가 검색용으로 안내하는 `PerplexityBot`과 공개 IP 범위의 접근을 확인합니다. 크롤러 방문은 접근 여부를 보여 주며, 답변 인용은 관측한 답변에서의 가시성을 보여 줍니다. [Perplexity 크롤러 공식 문서](https://docs.perplexity.ai/docs/resources/perplexity-crawlers)

저장소 루트에서 합성 예제를 실행합니다.

```sh
npm run visibility -- examples/perplexity-search/config.json --out ./perplexity-search-sample
```

관측 답변 두 건 중 한 건에서 소유 URL 인용이 집계됩니다. 한국어 질문의 출처는 Punycode 호스트와 인코딩된 한글 계정 경로를 사용합니다. 캐나다 영어 질문의 출처는 같은 호스트의 다른 계정입니다. 두 관측은 현지 날짜가 다르지만 동일한 시각을 가리킵니다. [개별 설치한 스킬](../README.md#개별-설치한-스킬에서-cli-실행)에서도 이 설정 파일을 실행할 수 있습니다.
