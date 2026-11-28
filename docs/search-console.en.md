# Import a localized Search Console CSV

1. In Google Search Console, open **Performance → Search results** for a property you can access. Choose the date range, search type, country and device filters, then export as CSV.
2. Unzip the export if needed and pick one Queries, Pages, or Dates table. The CLI recognizes English, Korean, Japanese, German, French, and Spanish headers. For other languages, rename the dimension column to `Queries`, `Pages`, or `Date` and the two metrics to `Clicks` and `Impressions`. Keep the original query text and URLs.
3. Use UTF-8 with or without a BOM. The CLI detects commas or semicolons from the header. Quote fields that contain the chosen delimiter. Counts accept plain digits or consistent three-digit thousands groups separated by commas, periods, spaces, nonbreaking spaces, or narrow nonbreaking spaces. For a comma-delimited file, quote a count such as `"1,200"`. The CLI derives CTR from totals, so optional fields such as `12,5 %` and decimal position values can stay as exported. Set `searchConsole` to the CSV path relative to the configuration file.

From the repository root, run the [synthetic page example](../examples/search-console/pages.csv):

```sh
npm run visibility -- examples/search-console/config.json
```

Open the reported `index.html`. The two internationalized URL labels should appear with **15 clicks**, **1,250 impressions**, and **1.2% CTR**. The same config works with the [individually installed SEO Orchestrator skill](../README.en.md#run-the-cli-from-a-single-installed-skill).

Record the property, dimension, filters, date range, and time granularity alongside each export. To compare South Korea and Japan, export each country separately with the same dimension, period, search type, and device filters. To compare two periods within one country, keep the other settings fixed. Search Console labels daily data in Pacific Time, so a daily row does not line up with a local calendar day in Seoul or Tokyo. The 24-hour view uses the browser's local time. The CLI keeps date labels as text, so retain the source time zone yourself. [Google's dimensions and time zones](https://support.google.com/webmasters/answer/17011259)

The CLI computes CTR from the sum of clicks and the sum of impressions in the imported rows. Google can omit query rows for privacy, limit exports, and aggregate page rows differently from the property chart. Compare Google exports separately from figures provided by Bing or Naver. [Google's export limits](https://support.google.com/webmasters/answer/12919797) · [Google's aggregation rules](https://support.google.com/webmasters/answer/17011364)
