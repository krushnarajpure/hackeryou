# React + Vite

## Google Analytics 4

Set `NEXT_PUBLIC_GA_MEASUREMENT_ID` in `.env.local` for local development and in
the deployment environment for production. The application sends one page view
per React Router navigation. In GA4 Admin, keep Enhanced Measurement enabled for
scrolls and outbound clicks, but disable **Page changes based on browser history
events** to prevent duplicate page views.

## Comments and website analytics

- `POST /api/articles/:slug/comments` validates and rate-limits replies; new replies remain pending until an administrator approves them.
- `GET /api/admin/comments` lists comments and status counts. `PATCH /api/admin/comments/:articleId/:commentId` approves or rejects a comment; `DELETE` on the same path removes it. These endpoints require an authenticated admin with the corresponding permission.
- The frontend posts anonymous page views to `POST /api/analytics/pageview`. The backend stores an HMAC of a first-party browser ID and daily aggregates, not raw visitor IDs, IP addresses, or URL query strings.
- Authenticated administrators with `analytics:read` can view the aggregate visitor and page-view report at `GET /api/analytics/overview`. Counts begin when this tracking is deployed; earlier page-wide history is not available.

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
