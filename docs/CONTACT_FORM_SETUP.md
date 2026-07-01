# Contact Form Setup

Last reviewed: 1 July 2026

The public contact page submits directly to Formspree. The endpoint is public
configuration, but it must still be supplied through the frontend environment
instead of being hardcoded in application source.

## Formspree configuration

1. Sign in to Formspree and create a form for the Rashtram AI website.
2. Configure and verify `rashtram.ai@rishihood.edu.in` as the recipient.
3. Copy the endpoint in the form `https://formspree.io/f/{form-id}`.
4. Confirm that Formspree accepts the `_gotcha` honeypot, `_subject`, and
   `_replyto` fields.
5. Submit a test entry and confirm delivery to the recipient inbox.

## Local development

Add the endpoint to `client/.env.local`:

```text
NEXT_PUBLIC_FORMSPREE_CONTACT_ENDPOINT=https://formspree.io/f/{form-id}
```

Restart the Next.js development server after changing the environment.

## Vercel

Add `NEXT_PUBLIC_FORMSPREE_CONTACT_ENDPOINT` to the `rashtram-ai` frontend
project for Production. Add it to Preview and Development only when those
deployments should submit to the same form.

Redeploy the frontend because `NEXT_PUBLIC_*` variables are embedded into the
browser bundle at build time. Verify required-field validation, invalid email,
success, provider failure, duplicate-submit prevention, and mobile layout on
the deployed `/contact` page.

No Formspree account secret or private key belongs in source control.
