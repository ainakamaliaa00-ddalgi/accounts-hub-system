# Deployment guide

## Recommended simple deployment

1. Deploy the backend to Render, Railway, or a VPS.
2. Set environment variable:
   - `JWT_SECRET`: a long secret password string.
3. Deploy the frontend to Vercel or Netlify.
4. Set frontend environment variable:
   - `VITE_API_URL`: your backend URL ending with `/api`.

## Important before real use

- Change default passwords.
- Replace SQLite with PostgreSQL if multiple users will update data frequently.
- Add database backups.
- Use HTTPS only.
- Do not publish sensitive finance data publicly.
