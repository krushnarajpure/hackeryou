# CMS Operations and API Guide

## Safety and rollout

The CMS changes do not seed articles, books, orders, users, or categories. Do not run a database migration against production until a current MongoDB export has been created and verified. Index migration commands require an explicit backup confirmation and perform duplicate checks before creating unique indexes.

In PowerShell, with MongoDB Database Tools installed and `MONGO_URI` available in the environment:

```powershell
mongodump --uri="$env:MONGO_URI" --archive="cms-pre-indexes.archive.gz" --gzip
npm --prefix backend run migrate-cms-indexes -- --confirm-backup
```

To roll back only the indexes created by the CMS migration:

```powershell
npm --prefix backend run rollback-cms-indexes -- --confirm-backup
```

The rollback does not delete database records. Keep the export until the migration and production smoke checks have passed. Book order reservation, payment capture, and fulfillment use MongoDB transactions; the production MongoDB deployment must support transactions (for example, an Atlas replica set).

## Access model

The API enforces permissions on the server; hiding a navigation item is not an authorization boundary.

| Role | Scope |
| --- | --- |
| `super_admin` | All permissions; only this role can change user roles |
| `admin` | CMS and administrative actions, except changing user roles |
| `content_editor` | Articles, categories, homepage sections, pages, media, revisions and success-story review; can save drafts but cannot publish/schedule articles |
| `design_manager` | Site content, homepage, navigation, settings, media and revisions |
| `analyst` / `viewer` | Analytics read-only |
| `store_manager` | Store catalog and order fulfillment; no access to analytics or user roles |
| `user` | Public site and own authenticated checkout |

Admin sessions use `Authorization: Bearer <JWT>`. Do not put credentials in the frontend or audit logs. The Admin Dashboard obtains permissions from the authenticated user profile.

The AI Content Assistant is available to roles with `articles:write`. Configure `GEMINI_API_KEY` on the backend only to use Gemini for article drafts, Google Search grounding, and image generation. `GEMINI_TEXT_MODEL` and `GEMINI_IMAGE_MODEL` optionally select models; defaults are `gemini-3.5-flash-lite` and `gemini-nano-banana-2.1`. Gemini takes precedence when both Gemini and `OPENAI_API_KEY` are configured; OpenAI remains the fallback when Gemini is not configured. Gemini requests use stateless interactions (`store: false`). Keep provider keys server-side; the authenticated `GET /api/ai-content/status` endpoint reports the provider/model without returning credentials. The assistant shows source links for review, formats pasted articles conservatively, and stores generated images in the existing media library. New articles stay drafts unless an authorized administrator explicitly confirms publishing. Updates to published articles require administrator permission and confirmation. Revoke any API key exposed in chat, tickets, or source control before configuring a replacement.

## API reference

All routes below are mounted under `/api`. Protected routes require a JWT and the role permission shown above. JSON is used unless the route accepts an image upload (`multipart/form-data`).

### Analytics

- `GET /analytics/overview?from=<ISO date>&to=<ISO date>` — verified article, enquiry, promotion-payment and book-order summaries. Range is limited to 90 days.
- `GET /analytics/articles?page=1&limit=25&search=<text>` — paginated article-level lifetime views and first-party visitor counts.

Article views use the existing article view tracker. The dashboard explicitly marks site-wide sessions, bounce rate, engagement time, traffic source and device breakdown as unavailable; they are not inferred from article data.

### Articles and media

- `GET /cms/articles?page=1&limit=20&status=draft|published&search=<text>` — protected article list with existing view/comment counts.
- `POST /articles` and `PUT /articles/:id` — create/edit article. Multipart upload field: `image`. An `article` JSON form field is also accepted for multipart submissions. Article content fields are allowlisted.
- `PATCH /articles/:id/publish`, `PATCH /articles/:id/archive`, `PATCH /articles/:id/restore` — publish, archive without deleting, and restore as a draft.
- `GET|POST /cms/media`, `PUT|DELETE /cms/media/:id` — media metadata and image uploads. Uploads are limited to JPEG, PNG and WEBP, up to 5 MB, and file signatures are checked. Validated files are staged locally, stored in the MongoDB GridFS `mediaFiles` bucket, and removed from the staging directory. Public article images stream from `GET /api/media/:id/content`. Referenced media metadata cannot be deleted; stored files are retained for backup safety.
- `GET /ai-content/status` — authenticated provider/model readiness; never returns API credentials.
- `POST /ai-content/generate`, `POST /ai-content/image` — authenticated AI article drafting and image generation; requires `articles:write` and is rate limited. Generated images are checked and saved to the CMS media collection.
- `PUT /ai-content/articles/:id` — AI assistant updates an existing draft with `articles:write`; updates to published articles require `articles:publish`.

Future article publication dates remain drafts until the scheduled publishing worker reaches the specified time. Published slugs cannot be changed through the editor.

### Site content

- `/cms/categories` — list/create/update/archive existing categories; category names are synchronized with article records in a transaction. Category slugs with existing articles are protected.
- `/cms/homepage` — list and update homepage section configuration.
- `GET /cms/public/homepage-business-essentials` — public, read-only Business Essentials heading and active feature-card configuration. Admins edit the persistent `business-essentials` homepage section from Homepage Manager; card routes are restricted to internal paths.
- `/cms/pages` — list/create/update/archive site pages.
- `/cms/navigation` — list and update navigation menus.
- `/cms/content` — list and upsert content keys.
- `/cms/settings` — read/update website settings, including checkout policies, tax treatment and shipping fee. Official public contact defaults are centralized in `shared/official-website-settings.json`; the Website Settings screen manages one email, mobile number, WhatsApp number and the three official social URLs.
- `GET /cms/revisions` and `POST /cms/revisions/:id/restore` — revision history and supported restore actions.

The public site's existing content remains in place until an administrator explicitly saves a change. `GET /cms/public/settings` and `GET /cms/public/content` expose only public website settings/content; do not put secrets in these documents.

Legacy contact/social values are normalized to the official defaults until an administrator saves the new settings. Public navigation and footer links omit unrelated social accounts; updates saved in Website Settings are reflected across the public site.

The homepage Business Essentials section has four Marathi-English default cards. Business Setup Guide and Government Schemes are omitted because those topics already appear in Explore Topics. Their existing routes remain available. The `/business-loans` route opens a listing of published articles in the `Business Loans` category. The other Business Essentials destination routes render a clear placeholder until verified Page Manager content is published. Do not enter licensing, government-benefit, loan or price claims without an approved source. Feature card titles, subtitles, Lucide icons, optional image URLs/media paths, internal destinations, enabled state and order are editable in Homepage Manager.
The public routes are `/business-licenses`, `/business-loans`, `/business-setup`, `/government-schemes`, `/machinery-equipment`, and `/franchise-opportunities`.
To add more articles to the Business Loans archive, use Article Manager and set the article category to exactly `Business Loans`; published articles appear on the archive and link to their normal `/articles/:slug` detail page.

### Users and audit

- `GET /admin/users?page=1&limit=25&search=<text>` — user list excludes password/reset-token fields.
- `PUT /admin/users/:id` — update approved profile fields and active status. Only a super admin may change roles; the last active super admin cannot be demoted or deactivated.
- `GET /admin/audit?page=1&limit=50` — paginated audit history. Audit summaries omit request bodies, secrets, and payment credentials.
- `GET /admin/storage` — MongoDB, uploaded-image and article storage measurements. It reports quota as unavailable unless a real quota source is configured.

### Book store and payments

- `GET /store/books`, `GET /store/books/:slug` — published catalog.
- `GET /store/checkout-config` — returns checkout availability and public policy links; it never returns payment secrets.
- `POST /store/checkout` — authenticated checkout. Requires `policyAccepted: true`, server-side pricing, inventory reservation and valid shipping details.
- `POST /store/orders/:id/verify` — verifies the Razorpay signature and confirms a captured payment with Razorpay before updating stock/order state.
- `POST /store/webhook` — verifies the raw-body webhook signature. Register this endpoint only with test-mode Razorpay during the current rollout.
- `/store/admin/books` — catalog list/create/update/status; supports image field `cover`.
- `GET /store/admin/orders` and `PATCH /store/admin/orders/:id/fulfillment` — order review and forward-only fulfillment status updates.

Book checkout is disabled unless test credentials, policy URLs, shipping and tax settings are configured. The server rejects non-test Razorpay keys. Digital delivery, refunds, and customer cancellation are not implemented; digital items cannot be checked out. Have local counsel/accounting validate store policies and tax behavior before enabling checkout, even in production test mode.

## Verification

Run the local checks from the workspace root:

```powershell
npm run build
npm --prefix backend test
```

The test suite includes role boundaries, draft-only content-editor behavior, checkout policy consent, rejection of live gateway credentials, analytics date validation, scheduled publishing, test-store price calculation and inventory reservation, capture verification, invalid signatures, failure stock release, duplicate webhook idempotency, and the index-migration backup gate.

Before a production rollout, use an authorized test account to verify each role and perform a test-mode order on a non-production catalog item. Confirm the test webhook signature, payment verification, reservation expiry, stock decrement, order fulfillment, audit record and analytics report. Do not enable live checkout based on this test rollout.

## Security checklist

- Keep JWT, MongoDB and Razorpay credentials server-side; never store them in CMS content, the public settings response, or audit summaries.
- Keep server permission checks enabled; UI visibility is not an access-control check. Only a super admin may change roles.
- Keep public book prices and quantities informational only; checkout always reloads prices and stock from MongoDB.
- Keep the order raw-body webhook signature verification enabled and register only the test-mode webhook while this rollout is test-only.
- Keep image type, size and file-signature checks enabled on upload routes.
- Keep media uploads in the MongoDB GridFS `mediaFiles` bucket; local upload files are temporary staging only.
- Back up MongoDB before applying or rolling back index changes. Do not run these scripts automatically during server startup.
- Review policy URLs, shipping/tax settings and the actual business rules before enabling test checkout. Do not enable live credentials in this implementation.

## QA report

- `npm run build`: passed; Vite reports a large-chunk advisory because the main JavaScript bundle is just over 500 kB.
- `npm --prefix backend test`: passed (24 tests), including Business Essentials feature-card validation and the existing mocked checkout/capture/webhook coverage.
- Business Essentials homepage cards use the existing `HomepageSection` collection; no database migration or content seeding is needed. The protected Homepage Manager endpoint validates card routes, icon names, unique keys and image URL types before storing configuration.
- `npm run lint`: completed successfully with warnings, including duplicate `pageType`/`status` keys in `backend/models/Page.js` and several existing unused-variable/React-hook warnings. These unrelated warnings were not changed.
- Authenticated browser smoke: dashboard rendered live article counts; Article Manager listed 269 articles over 11 pages and page 2 loaded; the create-article form opened without saving. The 390 px admin view had no horizontal overflow.
- Public browser smoke: homepage, article and category routes had no horizontal overflow at 390 px; the mobile drawer opened and closed with Escape. At 1440 px, desktop header height, hero top/height and article-column width matched the recorded baseline (102 px, top 141 px / height 270 px, and 794 px). Desktop and mobile screenshots were captured in the session.
- Business Essentials browser check: section follows Explore Topics and precedes category sections; its four default cards use Marathi-English labels, with Business Setup Guide and Government Schemes omitted to avoid duplication. Desktop uses four columns and mobile uses two columns with no horizontal overflow. All six existing destination routes remain available. Homepage Manager exposes four default editable feature forms; no CMS save was submitted.
- Database index migration and Razorpay network checkout were not run. At QA time, `backend/.env` had no `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` or `RAZORPAY_WEBHOOK_SECRET` entries; only presence and the test-key prefix were checked, never secret values. The public checkout-config endpoint also reported shipping, tax and policy links as unconfigured, with `checkoutAvailable: false` and `paymentMode: unconfigured`. No transaction was attempted. The index migration remains unapplied pending a verified database export.
