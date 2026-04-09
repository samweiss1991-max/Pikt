# pickt

A Next.js 14 web application built with the App Router, TypeScript, and Tailwind CSS.

## Tech Stack

- **Framework** — [Next.js 14](https://nextjs.org/) (App Router)
- **Language** — TypeScript
- **Styling** — Tailwind CSS
- **Auth & Database** — [Supabase](https://supabase.com/) (`@supabase/supabase-js`, `@supabase/auth-helpers-nextjs`)
- **Payments** — [Stripe](https://stripe.com/) (`stripe`, `@stripe/stripe-js`)
- **Email** — [Resend](https://resend.com/)

## Project Structure

```
pickt/
├── app/            # Next.js pages, layouts, and API routes
├── components/     # Reusable UI components
├── lib/            # Utility functions and service clients (Supabase, Stripe, Resend)
├── types/          # Shared TypeScript type definitions
└── public/         # Static assets
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Install dependencies

```bash
cd pickt
npm install
```

### Configure environment variables

Copy `.env.local` and fill in your keys:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only) |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `RESEND_API_KEY` | Resend API key |

### Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## PII Vault & Encryption

Candidate personal data is encrypted at rest using AES-256-GCM. The encryption module lives at `src/lib/encryption.js`.

### Environment variable

| Variable | Description |
|---|---|
| `CANDIDATE_PII_KEY` | 64 hex chars (32 bytes). Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

### Key rotation procedure

1. Generate a new key and set it as `CANDIDATE_PII_KEY_V2` in env
2. Run the rotation script: `node scripts/rotate-pii-keys.js`
   - Reads all `candidate_pii` rows with `encryption_key_version < 2`
   - Decrypts with old key (V1), re-encrypts with new key (V2)
   - Updates `encryption_key_version` to 2
3. Verify all rows have `encryption_key_version = 2`
4. Swap `CANDIDATE_PII_KEY` to the new key value
5. Remove `CANDIDATE_PII_KEY_V2` from env
6. Update the default version constant in `encryption.js` if needed

### Architecture

- `candidate_public` — marketplace-visible data, no PII
- `candidate_pii` — encrypted personal data, RLS denies all direct access
- PII is only decrypted server-side via `/api/candidates/:id/pii`
- A confirmed `candidate_unlock` record is required before any PII is returned
- `date_of_birth` and `gender` are never stored in this system

## Brand

The pickt logo renders as: **pick*t*** — the "t" is italic and accent green (`#c8f060`). Use the `<Logo />` component from `components/logo.tsx` wherever the brand name appears.
