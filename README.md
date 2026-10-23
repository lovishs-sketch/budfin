# BudFin on Netlify

public/index.html            the app (static)
netlify/functions/api.mjs    backend: email-code login, database, AI proxy (Netlify Functions + Netlify Blobs)

## Deploy (needs Git or the Netlify CLI; drag-and-drop does not run functions)
1. Push this folder to GitHub, then Netlify > Add new site > Import from Git. Or: `npm i -g netlify-cli && npm i && netlify deploy --prod`.
2. Site settings > Environment variables:
   - SESSION_SECRET   long random string (required)
   - RESEND_API_KEY and MAIL_FROM   to email login codes (resend.com; verify your sending domain)
   - ADMIN_EMAILS     comma-separated admin emails (can moderate and delete anything)
   - ALLOWED_DOMAIN   defaults to iitr.ac.in
   - ANTHROPIC_API_KEY (optional) for the AI buddy; AI_MODEL optional
   - DEV_OTP=1        testing only: shows the code on screen instead of emailing it. Never leave on in production.
3. Redeploy, open the site, sign in with an @iitr.ac.in email.

Local test: `netlify dev` (use a .env file with the same variables).
