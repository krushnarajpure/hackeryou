# Marathi Udyojak Backend

## Install and run

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Configure `.env` with a MongoDB Atlas connection string and a strong JWT secret. The production server must also have CORS origins, and Razorpay keys when payment APIs are used.

## API overview

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password/:token`
- `GET /api/users/profile`
- `PUT /api/users/profile`
- `PUT /api/users/change-password`
- `GET|POST /api/businesses`
- `GET /api/businesses/:id`
- `GET /api/businesses/slug/:slug`
- `PUT|DELETE /api/businesses/:id`
- `GET|POST /api/categories`
- `GET|PUT|DELETE /api/categories/:id`
- `GET|POST /api/business-ideas`
- `GET|PUT|DELETE /api/business-ideas/:id`
- `GET|POST /api/schemes`
- `GET|PUT|DELETE /api/schemes/:id`
- `GET /api/stories` and `GET /api/stories/:id` (published stories)
- `POST /api/stories/submit` (public submissions enter review)
- `GET /api/stories/admin`, `PATCH /api/stories/:id/publish` (admin)
- `GET|POST /api/articles`
- `GET /api/articles/:slug` and `GET /api/articles/slug/:slug`
- `PUT|DELETE|PATCH /api/articles/:id`
- `POST /api/enquiries`
- `GET|PUT|DELETE /api/enquiries/:id` (admin)
- `GET /api/advertisements/active`
- Advertisement create/update/delete/approval (admin)
- `GET /api/admin/dashboard`
- User, business approval, and payment admin APIs
- `POST /api/payments/create-order`
- `POST /api/payments/verify`
- `POST /api/payments/webhook`
- `/api/cms/*` administration, public settings/content, media, and revision APIs

## Admin CMS

See [CMS operations and API guide](./docs/cms-operations.md) for role permissions, analytics/store API details, test-mode checkout limits, verification steps, and the backup-gated CMS index migration and rollback commands.

The navigation-only refresh avoids content migration and preserves existing menu items while synchronizing the visible Follow submenu:

```bash
npm run migrate-navigation
```

## Seed data

`npm run seed` inserts only records that do not already exist. It does not delete or overwrite existing categories, ideas, or articles. Configure `ADMIN_EMAIL` and `ADMIN_PASSWORD` before running it. The seed command is not part of server startup.

## Source inventory and migration

`npm run inventory-source` writes a metadata-only URL and sitemap inventory to `reports/source-inventory.json`. It does not connect to MongoDB or copy article bodies or images.

The full source migration is blocked unless reuse authorization is explicitly confirmed:

```bash
npm run migrate-source -- --confirm-content-rights
```

Existing records are skipped by default. Only add `--update-existing-source-content` after confirming both reuse rights and that overwriting existing source records is intended. Failed post records remain eligible for a later retry; migration state and reports are saved separately.

## Authentication

Send the JWT as `Authorization: Bearer <token>`. Logout is stateless; clients must discard the token.

## Example requests

### Register

```json
POST /api/auth/register
{
  "name": "Rahul Patil",
  "email": "rahul@example.com",
  "password": "StrongPass1"
}
```

Response:

```json
{
  "user": { "id": "...", "name": "Rahul Patil", "email": "rahul@example.com", "role": "user" },
  "token": "<jwt>"
}
```

### Submit a business listing

Use `Authorization` and `multipart/form-data` with `businessName`, `ownerName`, `category`, `description`, `address`, `district`, `city`, `mobile`, optional `logo` and `images` fields.

New listings remain `pending` until an admin approves them.

### Submit an enquiry

```json
POST /api/enquiries
{
  "name": "Sneha Kulkarni",
  "mobile": "9876543210",
  "email": "sneha@example.com",
  "message": "Please share pricing and availability.",
  "business": "<business-id>"
}
```

## Razorpay

`POST /api/payments/create-order` creates a Razorpay order and a local `created` payment record. `POST /api/payments/verify` checks the HMAC signature and confirms the payment is captured through Razorpay before marking it paid. The webhook signature is verified, and only captured payments activate a promotion. Configure `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` on the server; never expose secrets in frontend code.
