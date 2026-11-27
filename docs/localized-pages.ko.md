# 다국어 페이지 배포 전 점검

[English guide](localized-pages.en.md)

1. 언어·지역별 버전에 고정 URL을 부여하고 본문을 해당 언어로 작성합니다. 사용자와 크롤러가 각 버전에 접근할 수 있도록 언어 전환 링크를 둡니다. 각 버전에 직접 접근할 수 있도록 IP나 브라우저 언어에 따른 자동 리다이렉트를 피합니다. [Google 다국어 사이트 안내](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites)
2. 각각 색인하려는 별도 버전에는 자기 URL을 canonical로 지정합니다. 같은 언어의 중복 페이지는 지역별 표시를 추가하기 전에 대표 URL을 정합니다. 같은 언어의 대표 페이지가 있다면 그 URL을 지정합니다. [Google canonical 안내](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
3. 각 페이지의 HTML head에 버전별 절대 URL을 선언합니다. 자기 자신을 포함하고 각 버전에서 서로 되돌아오는 링크를 확인합니다. `ko`는 한국어, `en-CA`는 캐나다 영어, `en`은 국가를 제한하지 않는 영어를 대상으로 합니다. 일치하는 언어·지역이 없을 때 사용할 URL은 선택적으로 `x-default`에 지정합니다. [Google hreflang 안내](https://developers.google.com/search/docs/specialty/international/localized-versions)

저장소 루트에서 [합성 예제](../examples/localized-pages/config.json)를 실행합니다.

```sh
npm run visibility -- examples/localized-pages/config.json
```

[SEO Orchestrator 개별 설치](../README.md#개별-설치한-스킬에서-cli-실행)에서는 설치된 `visibility.mjs`에 동일한 설정 경로를 전달합니다. 보고서에 로컬 페이지 세 개가 표시됩니다. 각 페이지는 국제화 도메인 `bücher.example`(ASCII 표기 `xn--bcher-kva.example`)에 canonical URL을 선언합니다. `report.json`에서 세 페이지에 canonical이나 noindex 관련 지적이 없는지 확인합니다. 간단한 예제이므로 공유 카드 관련 지적은 나올 수 있습니다. `hreflang`의 자기 참조와 상호 참조는 세 HTML 파일의 선언을 직접 대조합니다.

배포한 뒤에는 설정의 점검 대상을 공개 URL로 바꾸고 다시 실행해 리다이렉트, HTTP 헤더와 robots.txt를 확인합니다. Google이 색인했는지와 어떤 대표 URL을 선택했는지는 Search Console URL 검사에서 확인합니다. 위 `hreflang` 절차는 Google 검색 기준입니다. 네이버와 다음의 노출은 [국내 검색 안내](korea-search.ko.md)의 방법으로 각각 확인합니다.
