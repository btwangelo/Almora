# ALMORA Translate — foundation

This is an isolated module. It does not modify the existing ALMORA `index.html`, the existing `almora-storage-v2` Worker, or the existing R2 bucket.

## Current foundation

- Dedicated database tables for projects, source files, pages, jobs, glossary, versions, reviews and audit events.
- Row Level Security enabled on all eight tables.
- Browser roles have read-only table privileges. Writes must pass through this Worker.
- Staff authorization is based on `staff_roles` (owner, admin, translator, editor_bl, editor_gl, reviewer), never on user-editable profile metadata.
- The new Worker reuses the existing `almora-obras` R2 bucket through its own `ALMORA_BUCKET` binding.
- Original uploads are encrypted with AES-GCM before being stored. The old public file route can at most return ciphertext; the new Worker decrypts only after validating the user's ALMORA session and project access.
- Original files are not overwritten.

## Worker secrets

Configure these as encrypted Worker secrets, not as public variables:

- `SUPABASE_URL`: the existing ALMORA Supabase project URL.
- `SUPABASE_PUBLISHABLE_KEY`: the existing publishable key.
- `SUPABASE_SERVICE_ROLE_KEY`: the server-only service-role/secret key.
- `ALMORA_TRANSLATE_ENCRYPTION_KEY`: a newly generated random secret of at least 32 characters. Preserve it securely; losing it makes encrypted originals unrecoverable.

R2 binding:
- Variable name: `ALMORA_BUCKET`
- Bucket: `almora-obras` (reuse; do not create a new bucket).

Set `CORS_ORIGINS` to the exact production origins. The existing app currently uses GitHub Pages and Cloudflare Pages; keep only origins actually used by the deployed ALMORA front end.

## Current API

- `GET /api/health` — health check.
- `GET /api/projects` — list projects visible to the signed-in staff member.
- `POST /api/projects` — create a project; requires translator/admin/owner and an explicit rights confirmation.
- `GET /api/projects/:id` — project details and its files/jobs/pages/reviews/events.
- `POST /api/projects/:id/files` — upload ZIP, CBZ, PDF, PNG, JPG/JPEG or WebP as encrypted R2 objects.
- `GET /api/projects/:id/files/:fileId/download` — authorized download and decryption.

The initial upload limit is a technical default of 50 MiB and is configurable. It is not a per-user credit quota.

## Important: not yet enabled

The OCR, contextual translation, inpainting, lettering, visual QA, packaging queue consumer, and mandatory editorial publication workflow are not deployed yet. Do not present a project as translated just because its source files uploaded. The next implementation phase must add the processing provider adapters and asynchronous queue consumer, then the editorial review/publish endpoints.

## Deploying this separate Worker

1. Create a new Worker named `almora-translate`; do not edit `almora-storage-v2`.
2. Add the R2 binding above.
3. Add the four secrets above.
4. Set the origins and upload limit.
5. Deploy this Worker and test `GET /api/health`.
6. Add its actual `workers.dev` URL to the Translate front-end configuration.
7. Test an upload and download with a translator account and confirm a reader account receives 403.

Do not enable public access to the new Translate paths. Keep the R2 bucket private to server-side access wherever possible; encryption is an additional protection because the existing legacy Worker exposes a generic object-read route.
