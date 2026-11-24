# Final QA Report

## Scope and method

This is a read-only inventory and content-reconciliation pass. It queried the live WordPress REST API and sitemaps, read local MongoDB records and React route patterns, and compared normalized slugs, article text blocks, metadata, category/tag assignments, dates, and featured-image filenames.

This was **not** a page-by-page visual crawl. Individual source and local URLs, archive pagination, every image/link, browser console, and all responsive states were not exhaustively tested. No content was copied from the reference into the local database.

## Exact inventory counts

| Measure | Result |
|---|---:|
| Unique reference inventory rows | 824 |
| Reference published articles (REST) | 265 |
| Reference pages (REST, including the homepage record) | 17 |
| Reference category terms | 73 |
| Reference tag terms (REST) | 467 |
| Reference tag sitemap entries | 459 |
| Reference author sitemap entries | 2 |
| Local inventory rows | 852 |
| Local published articles | 265 |
| Local unpublished article records | 4 |
| Local page records | 17 |
| Local active categories | 73 |
| Local active tags | 459 |
| Local React route patterns | 33 |
| Missing published articles by normalized slug | 0 |
| Source static pages without a local slug match | 0 |
| Strictly classified incomplete articles | 0 |
| Exact duplicate published article bodies | 0 |
| Confirmed corrected records | 0 |

The local inventory row count includes database records, the homepage, and route patterns; it is not a count of unique rendered URLs.

## Content comparison findings

- All 265 published source articles have a local published article with the same normalized slug.
- 264 article bodies match exactly after HTML/entity/whitespace normalization.
- One article, `vyapari-pension-yojana-2025-marathi`, requires manual review:
  - Source title includes additional wording; the local title is shorter.
  - Source/local word counts: 1,850 / 1,623.
  - Source/local paragraph counts: 22 / 15.
  - 22 source paragraph occurrences and 15 local paragraph occurrences differ by exact normalized comparison. Because both directions contain differences, this is not treated as an automatic truncation or deletion.
  - Category matched; tag assignment differed; publication date matched; featured-image filename matched.
- 245 articles have matching featured-image filenames. For 20 source records, the source REST record has no featured-media ID. Asset loading and image rendering were not individually checked.
- 13 repeated-paragraph groups within articles are flagged for manual review in `duplicate_content_report.csv`; they are not confirmed accidental duplicates.
- No additional published articles were found by slug. Four unpublished local records are listed separately and were not treated as public-site extras.
- There are 15 exact local-only paragraph occurrences associated with the one article requiring review. They are evidence for review, not approved deletions.

## Pages, archives, and relationships

- All 73 category slugs exist locally. However, source-vs-local published-article counts differ for 60 of the 73 categories. The local Article schema stores one category string per article, whereas the source can associate an article with multiple categories. This may indicate missing archive membership; it is not proof of missing article records. Category archive routes and pagination still need direct testing.
- The 459 tag slugs listed in the source tag sitemap match the 459 active local tag slugs exactly. Eight additional source REST tag terms are absent from both that sitemap and the local active-tag set.
- The local router has no `/tag/:slug` or `/author/:slug` route. The page comparison therefore marks 467 source tag archives and 2 author archives as missing locally; their archive pages and pagination were not crawled.
- The source REST API lists 17 pages, including the homepage record; the page sitemap lists 16. The source post sitemap lists 266 URLs because `/all-posts/` is present there, but REST identifies it as a static page, not an article. The local database has the corresponding page record.
- Sixteen non-homepage static-page bodies matched by slug. This does not establish that each page route was visually opened.

## Requested final counts and status

| Requested item | Result |
|---|---|
| Missing pages | 469 archive routes absent locally: 467 tag and 2 author routes. Category slugs and static-page slugs exist. |
| Missing articles | 0 by normalized slug |
| Incomplete articles | 0 under the strict one-way omission rule; 1 article needs manual review for bidirectional content/title/tag differences |
| Extra local content | 0 extra published article records by slug; 15 local-only paragraph occurrences in the review article; 4 unpublished records are separate |
| Duplicate candidates | 0 exact duplicate article bodies; 13 repeated-paragraph groups need manual review |
| Corrected records | 0 |
| Manual review items | 1 article, 13 repeated-paragraph groups, 60 category-count differences, and unverified category/tag/author archive behavior |
| Inaccessible source pages | 0 explicit REST/sitemap request failures; most inventory URLs were not individually HTTP-probed, so page-level accessibility is unverified |
| Font | Poppins identified in computed reference styles; actual Devanagari glyph fallback not verified |
| Homepage content/design unchanged | YES — no homepage or application changes were made during this audit pass |
| Database backup | Not created; no database writes were made |

## Validation and limitations

- MongoDB connection succeeded and the local published-article API/database count was 265.
- The report generator completed successfully and produced all seven CSV files.
- Frontend build, backend tests, and new local visual tests were not run because no application code was changed.
- One source category archive was inspected; all archive pagination, all article pages, all links/images, and all local routes remain unverified.
- The previous local article-page browser check encountered HTTP 429, so local article rendering and sticky behavior remain unverified.
- Do not apply content corrections until the article discrepancy is manually reviewed, source-content reuse is authorized, and a verified MongoDB backup is made.

## Report files

- [reference_inventory.csv](./reference_inventory.csv)
- [local_inventory.csv](./local_inventory.csv)
- [page_comparison_report.csv](./page_comparison_report.csv)
- [missing_content_report.csv](./missing_content_report.csv)
- [extra_content_report.csv](./extra_content_report.csv)
- [duplicate_content_report.csv](./duplicate_content_report.csv)
- [article_validation_report.csv](./article_validation_report.csv)
- [font_audit.md](./font_audit.md)
- [change_log.md](./change_log.md)
