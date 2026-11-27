# 현지화된 Search Console CSV 가져오기

1. 접근할 수 있는 Google Search Console 속성에서 **실적 → 검색 결과**를 엽니다. 기간과 검색 유형, 국가, 기기 필터를 선택하고 CSV로 내보냅니다.
2. 필요하면 압축을 풀고 검색어·페이지·날짜 중 표 하나를 고릅니다. CLI가 인식하지 못하는 언어로 열 이름이 표시되면 차원 열 하나를 `Queries`, `Pages`, `Date` 중 해당하는 이름으로 바꾸고 클릭수와 노출수 열은 각각 `Clicks`, `Impressions`로 바꿉니다. 검색어 원문과 URL은 그대로 둡니다.
3. 쉼표로 열을 구분하고 UTF-8로 저장합니다. 내보낸 자료에서 `1 200` 또는 `1.200`의 구분 기호가 천 단위를 뜻하면 `1200`으로 적습니다. 쉼표가 들어간 값은 큰따옴표로 감쌉니다. 설정의 `searchConsole`에 설정 파일 기준 상대 경로를 입력합니다.

저장소 루트에서 [합성 페이지 예제](../examples/search-console/pages.csv)를 실행합니다.

```sh
npm run visibility -- examples/search-console/config.json
```

출력된 `index.html`에서 국제화 URL 두 개와 **클릭 15회**, **노출 1,250회**, **CTR 1.2%**를 확인할 수 있습니다. 같은 설정은 [SEO Orchestrator 개별 설치](../README.md#개별-설치한-스킬에서-cli-실행)에서도 사용할 수 있습니다.

내보낼 때 속성, 차원, 필터, 기간, 시간 집계 단위를 함께 기록합니다. 한국과 일본을 비교하려면 차원, 기간, 검색 유형, 기기를 맞춰 국가별로 각각 내보냅니다. 한 국가의 두 기간을 비교할 때는 다른 설정을 고정합니다. Search Console 일별 데이터는 미국 태평양 시간 기준이라 서울이나 도쿄의 자정으로 나눈 일별 수치와 집계 구간이 다릅니다. 24시간 보기에는 브라우저의 현지 시간대가 적용됩니다. CLI는 날짜를 텍스트로 보존하므로 원본 시간대를 함께 기록하세요. [Google 차원 및 시간대 안내](https://support.google.com/webmasters/answer/17011259?hl=ko)

CLI는 가져온 행의 클릭수 합을 노출수 합으로 나눠 CTR을 계산합니다. Google의 검색어 익명 처리, 내보내기 행 제한, 페이지별 집계 방식에 따라 속성 차트의 합계와 달라질 수 있습니다. Bing이나 네이버의 지표는 Google 실적과 별도로 비교하세요. [Google 내보내기 제한](https://support.google.com/webmasters/answer/12919797?hl=ko) · [Google 집계 기준](https://support.google.com/webmasters/answer/17011364?hl=ko)
