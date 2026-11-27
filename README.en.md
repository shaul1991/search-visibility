# Search Visibility

[한국어 안내](README.md)

Search Visibility is a free local CLI and a collection of agent skills for technical SEO and AI search visibility. Use it to audit pages, summarize Google Search Console exports, and check whether AI answers mention your brand or cite a source you own. The CLI runs on Node.js 18 or later with no package installation or API keys.

## Run the offline demo

```sh
git clone https://github.com/shaul1991/search-visibility.git
cd search-visibility
npm run demo
```

Open the printed `index.html` path in a browser. The demo uses two local pages, a synthetic search performance table, and three synthetic answers. The CLI messages and HTML report are currently in Korean. The accompanying `report.json` includes machine-readable fields such as `site.pages`, `searchPerformance`, and `ai.records`.

## Audit a site

Save this as `config.json`, replace the URL with a page you want indexed, and run the command below.

```json
{
  "targets": ["https://example.org/"],
  "expectIndexable": true
}
```

```sh
npm run visibility -- ./config.json
```

You can also supply local HTML paths in `targets` or a sitemap URL in `sitemap`. Input paths resolve relative to the config file. Remote audits request the specified sites. Reports are written locally under `visibility-reports/`.

## Measure search and AI visibility

- **Google search.** Set `searchConsole` to the path of a UTF-8 CSV exported from a property you can access. Import one query, page, or date table with English or Korean headers for the dimension, clicks, and impressions. The report calculates CTR from the imported rows.
- **AI answers.** Set `brand` to your brand name, then add the answers you collected to `observations` as an array or a path to a JSON file. Each record needs `engine`, `query`, `observedAt`, `answer`, and `sources`. Use an empty list for an observed answer with no cited links. Include the observation language in `locale` when comparing markets. The CLI analyzes the supplied sample locally. [Example records](examples/demo/answers.json)
- **Citation ownership.** Put hosts you own in `domains` to include their subdomains. For an account on a shared host, put its full HTTP(S) account URL in `ownedUrlPrefixes`. A citation counts if either rule matches. For example, `https://github.com/example-team` covers that account and its repositories. A sibling account such as `example-team-tools` is outside that scope. For a single GitHub account, use only the account prefix. Adding `github.com` to `domains` would include every account. Prefixes require a path on the same origin (scheme, host, and port). Omit credentials, query strings, and fragments.

## Install skills or contribute

To install the audit and citation skills for Claude Code and Codex, run this in the project where you use the agent.

```sh
npx skills add shaul1991/search-visibility -s seo-orchestrator ai-observations -a claude-code -a codex
```

Regional search guidance, translated examples, and reproducible parser cases are welcome. For a locale-specific CSV issue, include synthetic headers and a representative row. Run `npm test` from the repository root when changing code. [Skill catalog](README.md#구성) · [License](LICENSE)
