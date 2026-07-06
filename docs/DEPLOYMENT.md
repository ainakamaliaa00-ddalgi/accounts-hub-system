# Accounts Hub Proper System - Fresh Restart Package

This is the clean restart package for Accounts Hub.

It includes:
- Frontend: React + Vite
- Backend: Express API
- Database: simple JSON file storage
- Login and role-based access
- CSV/Excel import per module
- Accounts: FTA, FTAB, SN
- Roles: Admin, BOD, Shareholder

This version does **not** use `better-sqlite3`, so it does not need Python or Windows build tools.

## Default login
- Admin: `admin` / `admin123`
- BOD: `bod` / `bod123`
- Shareholder: `shareholder` / `share123`

## Run locally

Open terminal 1:
```bash
cd backend
npm install
npm run dev
```

Open terminal 2:
```bash
cd frontend
npm install
npm run dev
```

Open:
```text
http://localhost:5173
```

## Deploy online

### 1. GitHub
Upload these folders/files to GitHub:
- `backend`
- `frontend`
- `docs`
- `README.md`

### 2. Render backend
Create a Web Service with:
```text
Root Directory: backend
Build Command: npm install
Start Command: npm start
```

After deployment, test:
```text
https://YOUR-RENDER-LINK.onrender.com/api/health
```

It should show a JSON message that the API is healthy.

### 3. Vercel frontend
Create/import the project with:
```text
Root Directory: frontend
```

Add Environment Variable:
```text
Key: VITE_API_URL
Value: https://YOUR-RENDER-LINK.onrender.com
```

The frontend code automatically adds `/api`, so do not worry if the value does not end with `/api`.

Then deploy.
