# 검색 가시성 오픈소스 비교

사이트를 수집할 수 있는지, 검색 결과에서 몇 위인지, AI 답변에 브랜드가 실제로 언급·인용됐는지는 서로 다른 질문이다. 같은 ‘가시성’이라는 이름을 쓰는 프로젝트도 어떤 입력을 수집하고 어떤 답을 내는지에 따라 쓸 곳이 달라진다.

**조사 범위** · 2026-11-27 16:38 KST 기준. GitHub에서 셀프호스팅 SEO 크롤러, 오픈소스 SEO 제품군, AI 가시성 추적기, GEO, 네이버 SEO 감사와 관련된 프로젝트를 검색했다. 아래 21개 저장소에서 당시 커밋의 README와 라이선스 파일을 확인했다(`verified`). 기능·설치 조건은 해당 버전의 문서 기준이다. 제품별 실행 성능, 인용 정확도, 제3자 서비스의 현재 요금은 비교하지 않았다. 라이선스 열은 각 저장소가 소프트웨어에 표시한 라이선스다.

## 사이트 감사와 검색 순위

| 프로젝트 | 주요 기능 | 실행 조건과 데이터 출처 | 원문 · 코드 라이선스 |
| --- | --- | --- | --- |
| All-In-One Free SEO Tool | 사이트 감사·순위·콘텐츠·AI 노출을 한 앱에서 운영한다. | 기본 감사에는 키가 필요 없다. AI는 사용자 API 키 또는 로컬 Ollama를 선택한다. 검색량은 데이터 출처에 따라 추정값이다. | [README](https://github.com/IamRamgarhia/All-In-One-Free-SEO-Tool/blob/e75e6a935851430cec76d00f7d0c871413527358/README.md) · [MIT](https://github.com/IamRamgarhia/All-In-One-Free-SEO-Tool/blob/e75e6a935851430cec76d00f7d0c871413527358/LICENSE) |
| Lighthouse | Chrome이 실제로 렌더링한 페이지에서 성능·접근성·기술 SEO를 검사한다. | Chrome DevTools 또는 Node CLI에서 직접 실행한다. | [README](https://github.com/GoogleChrome/lighthouse/blob/ed5eb559f5bb2422df28ec5f80766909acc3a460/readme.md) · [Apache-2.0](https://github.com/GoogleChrome/lighthouse/blob/ed5eb559f5bb2422df28ec5f80766909acc3a460/LICENSE) |
| SiteOne Crawler | 내부 링크를 따라 검사하고 단일 HTML 보고서와 CI 판정을 만든다. | 기본 CLI는 독립 실행 파일이다. 브라우저 렌더링과 AI 보조는 선택 사항이다. | [README](https://github.com/janreges/siteone-crawler/blob/f3d967b190a77ff5f816b7ddab74c1a778d9dbaf/README.md) · [MIT](https://github.com/janreges/siteone-crawler/blob/f3d967b190a77ff5f816b7ddab74c1a778d9dbaf/LICENSE) |
| SEOnaut | 사이트를 반복 크롤링하고 발견한 SEO 문제를 웹 화면에서 확인한다. | Docker Compose로 앱과 데이터베이스를 운영한다. | [README](https://github.com/StJudeWasHere/seonaut/blob/a67387fe63a291be2ba49dd02399f20e453eb8b5/README.md) · [MIT](https://github.com/StJudeWasHere/seonaut/blob/a67387fe63a291be2ba49dd02399f20e453eb8b5/LICENSE) |
| CrawlSEO | 사이트 크롤링 결과에 Search Console과 Core Web Vitals를 결합한다. | 설치 안내에 Google OAuth 설정이 있다. 일부 키워드·백링크 데이터에는 DataForSEO 키가 필요하다. | [README](https://github.com/crawlseo/crawlseo/blob/4d8d7ea2b9e7789078e1d415d50aea38eab7bf9b/README.md) · [MIT](https://github.com/crawlseo/crawlseo/blob/4d8d7ea2b9e7789078e1d415d50aea38eab7bf9b/LICENSE) |
| SerpBear | 추적할 키워드별로 Google 검색 순위와 변동 이력을 기록한다. | 검색 결과 수집에 외부 스크레이핑 서비스 또는 사용자가 준비한 프록시를 쓴다. | [README](https://github.com/towfiqi/serpbear/blob/414ec8e441b1ae794ea7738c9e4c533a7c5e5dbc/README.md) · [MIT](https://github.com/towfiqi/serpbear/blob/414ec8e441b1ae794ea7738c9e4c533a7c5e5dbc/LICENSE) |
| Seo Panel | 여러 웹사이트를 한 관리자 화면에서 관리하는 설치형 SEO 도구다. | PHP·MySQL·웹 서버가 필요하다. Moz 연동에는 별도 키를 등록한다. | [README](https://github.com/sendtogeo/Seo-Panel/blob/6918ca06202f67f29e3a71b0163bcd19703b7e3f/README.md) · [GPL-2.0](https://github.com/sendtogeo/Seo-Panel/blob/6918ca06202f67f29e3a71b0163bcd19703b7e3f/COPYING) |
| SearchMirror | 검색 순위와 AI 검색 가시성 모니터링을 함께 제공한다. | 실시간 순위 검사는 DataBlue 크레딧을 사용한다. 일부 인용·콘텐츠 기능은 모델 연동을 선택한다. | [README](https://github.com/databluedev/searchmirror/blob/8a7a3d84eb05862bbf8d66bc8fd2b2a0e0071830/README.md) · [AGPL-3.0](https://github.com/databluedev/searchmirror/blob/8a7a3d84eb05862bbf8d66bc8fd2b2a0e0071830/LICENSE) |

## AI 답변 관측과 사이트 유입 분석

| 프로젝트 | 주요 기능 | 실행 조건과 데이터 출처 | 원문 · 코드 라이선스 |
| --- | --- | --- | --- |
| Elmo | 질문·모델별 브랜드 언급, 경쟁사, 실제 답변의 인용 URL을 시간순으로 비교한다. | 셀프호스팅은 Docker Compose를 사용한다. 권장 구성은 답변 수집에 Cloro, 분석에 OpenRouter 키를 쓴다. | [README](https://github.com/elmohq/elmo/blob/d8dda67d28bd9ef6f3127c544351246d5babe367/README.md) · [MIT](https://github.com/elmohq/elmo/blob/d8dda67d28bd9ef6f3127c544351246d5babe367/LICENSE.md) |
| OneGlanse | 제품의 웹 화면에서 질문하고 응답과 인용 출처를 저장한다. | 공급자 계정과 브라우저 로그인, 분석 모델 키와 Docker가 필요하다. 분석 시 답변을 설정한 모델에 전송한다. | [README](https://github.com/oneglanse/oneglanse/blob/fceb458c31e765f7ab1850151596bc0e80563956/README.md) · [MIT](https://github.com/oneglanse/oneglanse/blob/fceb458c31e765f7ab1850151596bc0e80563956/LICENSE) |
| Limelit Open | Go 실행 파일과 SQLite로 답변 측정 이력을 보관하고 MCP에서 조회한다. | 사용자가 제공한 키로 공급자를 호출한다. 엔진에 따라 별도 수집 서비스를 연결한다. | [README](https://github.com/limelit-co/open/blob/3ca4b45238f56ad5744480da6ed9bf05667ec8e1/README.md) · [Apache-2.0](https://github.com/limelit-co/open/blob/3ca4b45238f56ad5744480da6ed9bf05667ec8e1/LICENSE) |
| GEOInflow | 방문자·AI 검색 유입·크롤러 로그를 모으고 크롤러가 주장한 이름과 검증 증거를 따로 기록한다. | 자체 사이트에 추적·로그 수집을 연결한다. 모델 연결은 선택 사항이다. | [README](https://github.com/yaojingang/GEOInflow/blob/7007a2f533e689031b1ebddfe88e80daa005e330/README.md) · [MIT](https://github.com/yaojingang/GEOInflow/blob/7007a2f533e689031b1ebddfe88e80daa005e330/LICENSE) |
| GEORank | 브랜드의 GEO 진단과 AI 도구를 운영하는 웹 플랫폼이다. | Docker Compose와 자체 모델 서비스·키를 쓴다. 저장소는 소프트웨어와 내장 데이터의 권리 범위를 따로 안내한다. | [README](https://github.com/yaojingang/GEORank/blob/424a0cf92b37ad63c94ae9dc6f39745189ab7c94/README.md) · [Apache-2.0](https://github.com/yaojingang/GEORank/blob/424a0cf92b37ad63c94ae9dc6f39745189ab7c94/LICENSE) |

## GEO·AEO 진단과 에이전트 스킬

| 프로젝트 | 주요 기능 | 실행 조건과 데이터 출처 | 원문 · 코드 라이선스 |
| --- | --- | --- | --- |
| GEO Optimizer | 크롤러 접근·구조화 데이터·콘텐츠를 검사한다. 별도 명령으로 질문을 보내 브랜드 언급과 인용을 표본 조사한다. | 기본 진단은 키 없이 사용한다. 실제 엔진에 질문하는 CLI는 공급자 키를 쓰며 호출 비용이 발생할 수 있다. | [README](https://github.com/Auriti-Labs/geo-optimizer-skill/blob/4f428174fc078ac4eb0a73fcccf08a612dd29e63/README.md) · [MIT](https://github.com/Auriti-Labs/geo-optimizer-skill/blob/4f428174fc078ac4eb0a73fcccf08a612dd29e63/LICENSE) |
| open-geo | 정적 기술 진단과 단일 모델 질의를 제공한다. | 정적 진단은 키가 필요 없다. 라이브 질의에는 사용자 모델 키가 필요하다. 복수 엔진 동시 비교는 호스팅 기능이다. | [README](https://github.com/geofn-com/open-geo/blob/ee7c603ca13cd701f9973452ae947a01275b3906/README.md) · [MIT](https://github.com/geofn-com/open-geo/blob/ee7c603ca13cd701f9973452ae947a01275b3906/LICENSE) |
| AEO Toolkit | 공개 TypeScript 패키지에 크롤러·파서·감사 엔진·스키마 검증기가 있다. | 호스팅 콘솔, 두 MCP 서버와 Google·Bing 연동은 비공개 구현이다. 공개 코드의 범위를 README에 명시한다. | [README](https://github.com/Advance-Labs/aeo-toolkit/blob/426fd3528a9d91567c82e199345f1ded92714c9c/README.md) · [Apache-2.0](https://github.com/Advance-Labs/aeo-toolkit/blob/426fd3528a9d91567c82e199345f1ded92714c9c/LICENSE) |
| Ultimate SEO + GEO | 여러 기술 진단을 보고서로 합치고, 반복해서 기록한 AI 답변으로 인용률과 구간 추정을 계산한다. | 기록한 표본 집계는 모델 API 호출이 없다. Search Console과 GA4 조회에는 Google OAuth가 필요하다. | [README](https://github.com/mykpono/ultimate-seo-geo/blob/c92fdbaf1ddf7a0ef830952f73f913b08185a2f2/README.md) · [MIT](https://github.com/mykpono/ultimate-seo-geo/blob/c92fdbaf1ddf7a0ef830952f73f913b08185a2f2/LICENSE) |
| Web SEO + AEO + GEO (Google + Naver) | Next.js App Router용 메타데이터·사이트맵·구조화 데이터 작성과 빌드 결과 확인을 안내한다. | Cursor·Claude Code·Codex용 스킬이다. 검색 콘솔 등록은 사이트 소유 확인이 필요하다. | [README](https://github.com/gunheeaug/web-seo-aeo-geo-google-naver-skill/blob/d14ac7d8afc5a3e829883b300c108093402518ad/README.md) · [MIT](https://github.com/gunheeaug/web-seo-aeo-geo-google-naver-skill/blob/d14ac7d8afc5a3e829883b300c108093402518ad/LICENSE) |
| Marketing Skills | SEO·AI 검색·콘텐츠 전략·전환 최적화에 필요한 에이전트 스킬을 업무별로 제공한다. | 스킬을 골라 에이전트에 설치한다. 에이전트 이용 조건은 사용하는 제품에 따른다. | [README](https://github.com/coreyhaines31/marketingskills/blob/2bf95edb4ebd37198ab7fd18b99ba95c2145ec64/README.md) · [MIT](https://github.com/coreyhaines31/marketingskills/blob/2bf95edb4ebd37198ab7fd18b99ba95c2145ec64/LICENSE) |

## 연구 구현과 실험 설계

| 프로젝트 | 주요 기능 | 실행 조건과 데이터 출처 | 원문 · 코드 라이선스 |
| --- | --- | --- | --- |
| GEO / GEO-Bench | 질문 집합과 생성형 검색 결과를 이용해 콘텐츠 변경 전후의 가시성을 실험한다. | Python 실험 코드와 Hugging Face 데이터셋을 안내한다. 데이터셋은 별도 배포물이다. | [README](https://github.com/GEO-optim/GEO/blob/c9e985f2bc4b539a01e8e9d226ff2a3d8d29a888/README.md) · [Apache-2.0](https://github.com/GEO-optim/GEO/blob/c9e985f2bc4b539a01e8e9d226ff2a3d8d29a888/LICENSE) |
| AutoGEO | 생성형 엔진이 선호하는 작성 방식을 학습해 원문을 바꾸고 그 영향을 평가한다. | 실험 설정은 모델 API 키를 요구한다. 소형 모델 학습에는 CUDA GPU 요구사항이 있다. | [README](https://github.com/cxcscmu/AutoGEO/blob/49456df236774ea24087c44f45e9e52005b8e6a4/README.md) · [MIT](https://github.com/cxcscmu/AutoGEO/blob/49456df236774ea24087c44f45e9e52005b8e6a4/LICENSE) |

## 도구를 고르는 기준

- **사이트 전체의 링크와 브라우저 성능을 진단하려면** SiteOne Crawler로 내부 링크를 따라가며 문제 페이지를 찾고, 대표 페이지는 Lighthouse로 렌더링 비용을 확인한다. Search Visibility에서는 검사할 URL·사이트맵·HTML을 직접 정할 수 있어 배포 전후 같은 대상을 반복 점검하기 쉽다.
- **AI 답변을 정기적으로 수집하려면** 질문별 추세와 경쟁사 비교를 제공하는 Elmo를 검토할 수 있다. 실제 웹 제품에 로그인한 상태가 중요하면 OneGlanse의 수집 방식이 더 가깝다. 두 경우 모두 수집 환경과 연결 서비스가 필요하다.
- **AI 답변에 인용될 준비가 됐는지 점검하려면** GEO Optimizer의 기술 진단을 참고할 수 있다. 크롤러 통과나 구조화 데이터는 준비 상태를 설명한다. 실제 인용률에는 질문에 대한 답변과 인용 URL이 필요하다.

## Search Visibility에 반영한 판단

1. 기술 진단과 AI 답변의 관측을 한 보고서에서 각각 표시한다. 도메인 인용률에는 관측한 답변 수를 분모로 제시하고, 표본이 없으면 미관측으로 표시한다.
2. 무료 실행 경로에는 로컬 HTML·사이트맵 또는 URL과 사용자가 기록한 답변을 쓴다. 모델 API, 검색 결과 공급자, 데이터베이스를 준비하지 않아도 JSON을 만들고 HTML 보고서를 열 수 있다. 답변을 수동으로 기록한 표본은 기록자의 질문·기간·엔진 선택에 따라 달라진다.
3. 네이버 등 채널별 점검 절차는 독립 스킬에 두고 여러 채널을 함께 확인할 때 조합한다. 위 프로젝트에서 수집 방식과 결과 표시 방식을 비교했으며, 이 저장소의 코드와 예제는 자체 구현했다.

국내 서비스 화면을 비교하려면 Ainnect가 공개한 네이버 AI 브리핑 사례에서 질문·브랜드별 노출을 확인할 수 있다. 이 사례는 상용 서비스가 설명하는 측정 화면이며, 위의 오픈소스 21개와 별도로 참고했다. [Ainnect 공식 소개](https://ainnect.co.kr/blog/insights/naver-ai-briefing-brand-visibility/)
