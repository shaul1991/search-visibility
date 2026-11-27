# 국내 검색과 AI 브리핑 가시성 측정

[English guide](korea-search.en.md)

| 관측 화면 | 기록할 항목 |
| --- | --- |
| 네이버 웹 검색 | 소유 확인한 사이트의 서치어드바이저에서 클릭수·노출수·표시된 조회 기간·기기 필터를 기록합니다. 웹 검색 지표 범위에서 VIEW·블로그 검색·광고 등은 제외됩니다. 기간을 비교하기 전에 업데이트 기준일을 확인합니다. [네이버 서치어드바이저](https://searchadvisor.naver.com/guide/report-expose-ctr) |
| Daum 웹 검색 | 관리하는 사이트의 무료 웹마스터도구 Beta에서 웹문서 클릭수와 노출수를 기록합니다. 수집과 색인 건수는 각각 별도 열에 기록합니다. [Daum 고객센터](https://cs.daum.net/faq/service/15/category/4118/detail/38325) |
| 네이버 AI 브리핑 | 브리핑 표시 여부를 기록하고 화면에 나온 답변과 출처 URL을 복사합니다. AI탭 대화는 별도 화면으로 기록합니다. [AI 브리핑](https://help.naver.com/service/5626/contents/24119) · [AI탭](https://help.naver.com/service/5626/contents/25122?lang=ko&osType=COMMONOS) |

네이버와 Daum의 공개 검색 화면에서 같은 한국어 검색어를 입력합니다. 화면별로 검색어 원문, 접속 지역, 기기, 세션 또는 로그인 상태, `+09:00` 같은 오프셋이 포함된 관측 시각을 적습니다. 일반 검색 결과에서는 결과 영역과 화면에 보인 일치 URL을 기록합니다. 시점별 비교에는 같은 기기·지역·화면을 사용합니다. 웹마스터 도구의 집계는 별도 기록에 보관합니다. CLI의 CSV 입력은 Google Search Console 내보내기용입니다.

한국 시장의 한국어 AI 브리핑 답변에는 `engine: "naver-ai-briefing"`과 `locale: "ko-KR"`을 사용합니다. 실제 접속 지역은 수집 기록에 남깁니다. 브리핑이 표시되지 않거나 로딩에 실패한 시도도 수집 기록에 적습니다. 답변은 표시됐지만 출처 링크가 없을 때는 `sources: []`를 사용합니다. 전체 시도 중 브리핑이 표시된 비율과 관측한 브리핑 중 소유 URL을 인용한 답변 비율을 각각 기록합니다. 플랫폼 프로필에서 제공하는 인용수는 집계 기간과 함께 별도 열에 기록합니다. [네이버 프로필 인용수](https://help.naver.com/service/30056/contents/25217?lang=ko&osType=COMMONOS)

저장소 루트에서 새 출력 디렉터리를 지정해 합성 예제를 오프라인으로 실행합니다.

```sh
npm run visibility -- examples/korea-search/naver-ai-briefing.config.json --out ./naver-briefing-sample
```

`report.json`에서 답변 두 건에 브랜드가 언급되고 한 건이 소유 URL을 인용한 결과(50%)를 확인할 수 있습니다. 한글 도메인은 정규화되며 이름이 비슷한 네이버 블로그는 설정한 계정 경로에 포함되지 않습니다. 첫 관측일은 한국에서 11월 1일, UTC에서 10월 31일입니다. 지역별 집계 날짜를 정할 때 기록한 오프셋을 사용합니다. 시점별 비교에는 같은 조건으로 모은 답변을 짝지어 사용합니다. [전후 비교 안내](ai-comparison.ko.md)
