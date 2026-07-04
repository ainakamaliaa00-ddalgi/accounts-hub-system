# Accounts Hub Proper System - Easy Run Version

This is a proper web-app package for Accounts Hub with:
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

Change these before using online.

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

Then open the frontend URL shown by Vite, usually:

http://localhost:5173

## Data storage

The backend will create this file automatically:

`backend/accounts_hub_data.json`

That file stores users and imported finance records. Keep a backup of this file if you start entering real data.

## Role access

Admin can access Claim, DB, OP, BS, Trial Balance, and General Ledger. Admin cannot access Profit & Loss or Balance Sheet.

BOD can access Trial Balance, General Ledger, Profit & Loss, and Balance Sheet. View-only.

Shareholder can access Profit & Loss and Balance Sheet only. View-only.

## Importing data

Login as Admin and use the Import CSV/Excel button in allowed modules.
For BOD/Shareholder, import is hidden.

For Profit & Loss and Balance Sheet imports, prepare clean CSV/Excel with the columns used in your report.

## Updated importer notes

This version has a more flexible Excel/CSV importer. It can:
- find the header row even if the table starts lower in the Excel sheet,
- recognise common header names such as Ref No, Reference No, Seller/Supplier, Details/Description, Amount/RM, Debit, Credit, Balance,
- skip blank/template/error rows,
- import all month sheets in one workbook,
- filter BS imports by the selected bank where possible,
- clear the current module before re-importing corrected data.

If an earlier import created blank rows, click **Clear Current** in that module first, then import the Excel/CSV again.
