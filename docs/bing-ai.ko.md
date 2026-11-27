# Bing과 Copilot에서 AI 인용 측정하기

[English guide](bing-ai.en.md)

Bing Webmaster Tools에서 접근 권한이 있는 사이트를 선택하고 **AI Performance**를 엽니다. 사이트, 조회 기간, 필터, 기록 날짜를 남깁니다. 같은 사이트에서 기간별 수치를 대조하려면 **Compare**를 사용합니다. 기간 길이와 필터를 맞춥니다. Microsoft의 미리보기는 Microsoft Copilot, Bing AI 요약과 일부 파트너 서비스를 집계합니다. [AI Performance 지표](https://blogs.bing.com/webmaster/2026/2/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview/) · [Compare와 Citation Share](https://blogs.bing.com/search/2026/6/New-AI-Visibility-Insights-in-Bing-Webmaster-Tools-Intents-Topics-Citation-Share-Compare/)

| 근거 | 측정 대상 |
| --- | --- |
| Total Citations | 선택한 기간에 지원 서비스의 답변에 표시된 출처 인용 건수입니다. |
| Citation Share | 특정 그라운딩 검색어의 전체 인용 중 내 사이트의 비중입니다. 그라운딩 검색어는 시스템이 자료를 검색할 때 쓴 표현이며, 보고서에는 표본이 표시됩니다. |
| 로컬 CLI 인용률 | 직접 수집한 답변 중 소유 URL이 하나 이상 인용된 답변의 비중입니다. |

각 지표는 별도 열에 기록하고 비율의 분모도 남깁니다. 시장별로 확인하려면 답변을 직접 수집합니다. 입력한 질문 원문, 서비스 화면, 언어, 접속 지역, 로그인 상태, UTC 오프셋이 포함된 관측 시각을 기록합니다. Copilot과 Bing AI 요약은 서비스별로 나눕니다. 언어와 시장별 질문 세트를 준비하고, 기간을 비교할 때는 같은 질문과 조건을 사용합니다. 답변이 표시되지 않은 시도는 수집 기록에 남깁니다. 답변이 보였고 출처 링크가 없었다면 `sources: []`를 사용합니다. [변경 전후 비교](ai-comparison.ko.md)

저장소 루트에서 합성 예제를 오프라인으로 실행합니다.

```sh
npm run visibility -- examples/bing-ai/config.json --out ./bing-ai-sample
```

`report.json`에 답변 2건 중 1건이 인용으로 집계됩니다. 한국어 답변은 `bücher.example`의 퓨니코드 주소를 인용합니다. 캐나다 영어 답변에는 출처 링크가 없습니다. 두 관측은 같은 순간이며 한국은 11월 1일, 캐나다 태평양 지역은 10월 31일입니다. 시장별 날짜 집계에는 각 기록의 현지 날짜를 사용합니다. 언어별로 답변 1건씩을 넣었으므로 입출력 형식을 확인하는 예제로 사용합니다. [개별 설치한 스킬](../README.md#개별-설치한-스킬에서-cli-실행)에서도 같은 설정을 사용할 수 있습니다.
