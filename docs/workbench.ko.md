# 실제 데이터로 검색 가시성 점검하기

저장소를 내려받고 Node.js 18 이상에서 실행합니다. npm 패키지 설치나 API 키가 필요하지 않습니다. 아래 세 입력 중 가지고 있는 자료부터 넣으세요.

| 확인하려는 것 | 입력 | 얻는 결과 |
| --- | --- | --- |
| 페이지를 크롤링하고 색인할 때 걸리는 문제 | `targets`에 HTTP(S) URL 또는 로컬 HTML 경로, 또는 `sitemap`에 사이트맵 URL | 페이지별 문제·근거·관련 스킬, 수집 실패와 범위 |
| Google 검색에서의 실제 노출과 클릭 | Search Console 실적 보고서에서 내보낸 CSV 한 개 | 가져온 행의 노출수·클릭수, 합산 CTR, 주요 행 |
| AI 답변에 브랜드와 출처가 등장하는 빈도 | 직접 수집한 답변, 질문, 엔진, 시각, 출처 URL | 엔진별 표본 수·브랜드 언급률·소유 도메인 인용률과 답변별 근거 |

## 처음 실행

```bash
npm run demo
```

별도 계정 없이 예제를 끝까지 실행할 수 있습니다. 콘솔에 표시되는 `index.html`을 브라우저로 여세요. HTML을 열 때는 인터넷 연결이 필요 없습니다. 같은 디렉터리의 `report.json`에서 전체 행과 점검 결과를 읽을 수 있습니다. 예제의 검색 실적과 AI 답변은 합성 자료입니다.

## 내 데이터 연결

`config.json`을 만들고 보유한 입력만 지정하세요. 파일 경로는 설정 파일의 위치를 기준으로 해석합니다. URL과 도메인은 자신의 것으로 바꿉니다.

```json
{
  "brand": "우리 브랜드",
  "aliases": ["Our Brand"],
  "domains": ["example.com"],
  "sitemap": "https://example.com/sitemap.xml",
  "targets": ["./public/launch.html"],
  "expectIndexable": true,
  "limit": 25,
  "searchConsole": "./queries.csv",
  "observations": "./answers.json"
}
```

```bash
npm run visibility -- ./config.json
```

기본 출력은 현재 디렉터리의 `visibility-reports/` 아래에 매 실행마다 생성됩니다. `--out <새 폴더>`로 위치를 지정할 수 있습니다. 같은 이름의 기존 폴더는 보존합니다. 입력 파일 하나의 크기 제한은 설정·관측 JSON·성과 CSV 각각 16 MiB입니다. 개인 데이터는 로컬 파일에서 처리되며, 외부 URL을 지정한 기술 진단은 해당 사이트에 HTTP 요청을 보냅니다.

### 사이트 진단

`targets`는 URL과 HTML을 섞어 쓸 수 있습니다. 로컬 HTML에서는 파일 내용만, URL에서는 robots.txt·HTTP 응답 헤더·이미지도 확인합니다. `expectIndexable`은 공개·색인이 목표인 페이지에서 noindex를 실패로 처리합니다. 목록에 비공개 페이지도 있다면 별도의 설정으로 점검하세요.

사이트맵은 HTTP(S)의 XML urlset, sitemapindex 및 gzip을 지원합니다. 명시한 대상을 먼저 점검하며 중복 페이지는 한 번만 셉니다. 기본 상한은 25페이지, 설정 가능 범위는 1~100페이지입니다. 자동 발견은 시작 사이트맵과 같은 출처(프로토콜·호스트·포트)에 한정됩니다. 다른 출처의 CDN 자산까지 점검하려면 해당 페이지를 `targets`에 명시하세요. 사이트맵은 최대 10개 문서·각 2 MiB, 페이지와 그 부속 리소스는 각각 4 MiB, 네트워크 페이지당 시간 예산은 15초입니다. 상한으로 빠진 대상이나 수집 오류는 보고서에서 확인합니다. [사이트맵 프로토콜](https://www.sitemaps.org/protocol.html)

### Google Search Console 실적

본인이 접근할 수 있는 속성에서 **검색 결과 실적 → 기간과 필터 선택 → 내보내기 → CSV**를 선택합니다. 압축을 풀고 검색어·페이지·날짜 중 한 차원의 표 하나를 `searchConsole`로 지정하세요. 영어·한국어 헤더를 인식합니다. 클릭수와 노출수를 읽고 CTR은 **선택한 행의 클릭수 합 ÷ 노출수 합**으로 계산합니다. 페이지 표와 검색어 표에는 같은 실적이 겹칠 수 있어 한 실행에 한 표만 입력합니다. 날짜나 검색 유형 등의 필터를 비교할 때는 원본 내보내기의 기간과 필터도 보관하세요. 검색어 익명 처리와 내보내기 행 제한 때문에 합계가 Search Console 상단 수치와 다를 수 있습니다. [Google 실적 보고서](https://support.google.com/webmasters/answer/7576553) · [데이터 내보내기](https://support.google.com/webmasters/answer/12919797)

### AI 답변 관측

`observations`에는 배열이나 동일한 배열을 담은 JSON 파일 경로를 지정합니다. `brand`는 관측이 있는 경우 필수입니다. `domains`에는 추적할 호스트명을, `aliases`에는 실제 브랜드의 다른 표기를 넣습니다. 아래는 **합성 예시**입니다.

```json
[
  {
    "engine": "예시 엔진",
    "query": "주말 행사 일정은 어디서 확인하나요?",
    "observedAt": "2026-11-25T10:00:00+09:00",
    "answer": "우리 브랜드에서 지역별 행사 일정을 확인할 수 있습니다.",
    "sources": ["https://example.com/events"],
    "locale": "ko-KR"
  }
]
```

한 행에는 실제로 확인한 답변 한 건을 넣습니다. 답변에서 직접 표시한 출처가 없으면 `sources: []`로 기록합니다. 답변을 얻지 못한 질문은 집계에서 제외합니다. 언급은 답변 본문의 브랜드·별칭, 인용은 출처의 호스트명과 소유 도메인·하위 도메인의 일치로 셉니다. 표본 0건 또는 추적 도메인 미지정은 보고서에 미측정으로 표시됩니다. 선택 필드 `evidenceUrl`, `model`, `locale`로 답변을 다시 확인할 맥락을 남길 수 있습니다. 공개할 보고서에는 포함해도 되는 질문·출처·공유 링크만 사용하세요. [관측 스킬](../skills/ai-observations/SKILL.md)

## CI에서 실행

```bash
npm run visibility -- ./config.json --out ./release-audit --fail-on-findings
```

| 종료 코드 | 의미 |
| --- | --- |
| 0 | 입력한 범위의 보고서 생성. 기본 모드에서는 진단 결과를 보고서에서 확인 |
| 1 | `--fail-on-findings`에서 페이지 진단 FAIL 확인. 보고서 생성 |
| 2 | 입력·수집·파일 쓰기 오류. 일부 페이지만 수집 실패했거나 사이트맵을 읽을 수 없을 때에도 확보한 결과를 보고서로 저장 |

실제 색인·순위를 확인하려면 해당 플랫폼의 진단 도구를 쓰세요. AI 답변 수집은 직접 기록한 표본을 가져오는 방식입니다. 샘플을 늘리거나 시점별로 비교할 때는 질문·엔진·언어와 수집 방법을 일정하게 유지하세요. [네이버 웹마스터 가이드](https://searchadvisor.naver.com/guide) · [Google 검색의 AI 기능](https://developers.google.com/search/docs/appearance/ai-features)
