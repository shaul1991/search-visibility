# ChatGPT 검색 가시성 측정

[English guide](chatgpt-search.en.md)

1. chatgpt.com에서 새 대화를 열고 **+ → 웹 검색**을 선택한 뒤 질문합니다. 질문 원문, 언어·로캘, 검색 지역, 기기, 로그인 상태, 위치 및 메모리 설정, UTC 오프셋을 포함한 시각을 기록합니다. 비교할 때는 조건을 맞춥니다. ChatGPT 검색은 IP 기반 대략적 위치와 선택적으로 공유한 기기 위치, 저장된 맥락을 활용할 수 있습니다. 사용 한도나 워크스페이스 설정으로 검색을 실행하지 못한 경우는 시도만 별도로 기록합니다. [OpenAI 검색 도움말](https://help.openai.com/en/articles/9237897-searching-the-web-with-chatgpt)
2. 답변 본문과 답변이 직접 인용한 URL을 복사합니다. **출처 보기**에는 인용과 함께 관련 링크가 표시될 수 있습니다. 본문 인용을 확인한 뒤 해당 URL을 `sources`에 넣습니다. 검색 답변이 표시됐고 인용이 없다면 `sources: []`를 입력합니다. 이 관측에는 `chatgpt-search`처럼 동일한 `engine` 값을 씁니다. [전후 비교 안내](ai-comparison.ko.md)
3. 관측한 답변 수와 그중 소유 범위의 URL을 인용한 답변 수를 함께 보고합니다. 유입은 자체 분석 도구에서 별도로 측정합니다. 방문 URL이나 세션 소스에 ChatGPT 유입 신호가 있는지 확인합니다. 예를 들어 `utm_source=chatgpt.com`이 실제로 붙은 방문을 집계할 수 있습니다. 분석 도구의 시간대, 기간, 유입 필터를 기록합니다. 인용은 표본 내 가시성을, 세션은 사이트에 귀속된 유입을 각각 보여줍니다.

크롤링 가능 여부는 대상 페이지에 적용되는 `OAI-SearchBot`용 robots.txt 규칙과 호스트 또는 CDN의 공개 IP 대역 허용 상태를 확인합니다. OpenAI는 검색과 모델 학습(`GPTBot`)에 별도 설정을 사용합니다. 크롤링 허용은 검색에 표시될 수 있는 조건입니다. [OpenAI 크롤러 문서](https://developers.openai.com/api/docs/bots)

저장소 루트에서 합성 예제를 실행합니다.

```sh
npm run visibility -- examples/chatgpt-search/config.json --out ./chatgpt-search-sample
```

소유 인용은 답변 2건 중 1건입니다. 한국어 답변은 Punycode 호스트와 퍼센트 인코딩 경로, 예시 유입 매개변수가 있는 URL을 인용합니다. 영어 답변은 같은 공유 호스트의 다른 계정을 인용합니다. 두 시각은 현지 날짜가 다르지만 같은 순간입니다. `locale`에는 질문의 언어와 로캘을 넣고 실제 검색 지역은 측정 기록에 별도로 남깁니다. 동일한 설정은 [개별 설치한 스킬](../README.md#개별-설치한-스킬에서-cli-실행)에서도 실행할 수 있습니다.
