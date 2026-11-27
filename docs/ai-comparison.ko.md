# 변경 전후 AI 출처 인용 비교

[English guide](ai-comparison.en.md)

1. 사이트를 바꾸기 전에 질문 원문과 수집 계획을 저장합니다. 전후에 같은 엔진, 제품 화면, 검색 모드, 확인 가능한 모델, 접속 지역, 언어, 반복 횟수를 사용합니다. 매 시도는 새 대화에서 시작하고 가능한 범위에서 계정과 개인화 설정을 맞춥니다. 수집 기간과 시간대를 기록합니다. 질문 문구가 같아도 접속 지역에 따라 결과가 달라질 수 있습니다. [ChatGPT 검색 공식 문서](https://help.openai.com/en/articles/9237897-searching-the-web-with-chatgpt)
2. 변경 후 다시 수집합니다. 집계할 때 전후에 같은 `brand`, `aliases`, `domains`, `ownedUrlPrefixes`를 사용합니다. 실제로 받은 답변과 화면에 표시된 출처를 기록합니다. 답변에 출처가 없으면 `sources: []`를 넣습니다. 실패한 시도는 따로 기록하고, 양쪽에서 답변을 확보한 동일 질문·반복 회차끼리 비교합니다. 누락한 회차도 결과에 함께 적습니다.
3. 엔진·검색 모드·시장별로 비교합니다. `locale`에는 답변 관측 언어를 넣고 시장과 검색 모드는 수집 기록에 따로 남깁니다. CLI 요약은 엔진별로 집계합니다. 시장·모드별 합계가 필요하면 설정 파일을 나누거나 `ai.records`를 질문과 언어별로 확인합니다. 비율과 함께 답변 수를 보고합니다. 관측 표본의 차이만으로 변화 원인을 확정하기는 어렵습니다.

## 합성 예제 실행

Node.js 18 이상에서 저장소 루트로 이동한 뒤, 새 출력 디렉터리 두 곳을 지정합니다.

```sh
npm run visibility -- examples/ai-comparison/before.config.json --out ./ai-before
npm run visibility -- examples/ai-comparison/after.config.json --out ./ai-after
```

각 `index.html`은 요약을 보여줍니다. 각 `report.json`의 `ai.records`에서 짝을 맞춘 답변을 확인할 수 있습니다. 두 실행 모두 답변 두 건에 브랜드가 언급됩니다. 소유 출처의 인용은 1/2에서 2/2로 50%p 늘어납니다. 한국어 질문에서 소유 출처 인용이 새로 생겼고 영어 질문에서는 두 시점 모두 소유 출처를 인용했습니다. 입력에는 UTF-8 질문, 보고서에서 ASCII로 정규화되는 유니코드 호스트명, 서울과 뉴욕의 UTC 오프셋을 명시한 시각이 들어 있습니다.

Google Search Console의 웹 검색 실적에는 AI 개요와 AI 모드 유입도 포함됩니다. 해당 트래픽 지표와 이 예제의 답변별 인용률은 각각 기록합니다. [Google 검색 센터 공식 문서](https://developers.google.com/search/docs/appearance/ai-features)
