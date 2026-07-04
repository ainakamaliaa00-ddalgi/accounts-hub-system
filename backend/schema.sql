PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('ADMIN','BOD','SHAREHOLDER')),
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE CHECK(code IN ('FTA','FTAB','SN')),
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS modules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK(report_type IN ('DAILY','BANK','TB','GL','PL','BS'))
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role TEXT NOT NULL,
  module_key TEXT NOT NULL,
  can_view INTEGER NOT NULL DEFAULT 0,
  can_add INTEGER NOT NULL DEFAULT 0,
  can_edit INTEGER NOT NULL DEFAULT 0,
  can_delete INTEGER NOT NULL DEFAULT 0,
  can_export INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(role, module_key),
  FOREIGN KEY(module_key) REFERENCES modules(key)
);

CREATE TABLE IF NOT EXISTS claim_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_code TEXT NOT NULL,
  month TEXT,
  for_field TEXT,
  date TEXT,
  ref_no TEXT,
  seller TEXT,
  item TEXT,
  category TEXT,
  amount REAL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS db_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_code TEXT NOT NULL,
  month TEXT,
  date TEXT,
  ref_no TEXT,
  received_from TEXT,
  description TEXT,
  category TEXT,
  amount REAL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS op_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_code TEXT NOT NULL,
  month TEXT,
  date TEXT,
  supplier TEXT,
  item TEXT,
  category TEXT,
  amount REAL DEFAULT 0,
  payment_platform TEXT,
  order_no TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bank_statement_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_code TEXT NOT NULL,
  bank_key TEXT NOT NULL,
  month TEXT,
  date TEXT,
  description TEXT,
  debit REAL DEFAULT 0,
  credit REAL DEFAULT 0,
  category TEXT,
  balance REAL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS trial_balance_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_code TEXT NOT NULL,
  code TEXT,
  account TEXT,
  debit REAL DEFAULT 0,
  credit REAL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS general_ledger_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_code TEXT NOT NULL,
  date TEXT,
  ref_no TEXT,
  account TEXT,
  description TEXT,
  debit REAL DEFAULT 0,
  credit REAL DEFAULT 0,
  balance REAL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS profit_loss_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_code TEXT NOT NULL,
  section TEXT,
  account TEXT,
  amount REAL DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS balance_sheet_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_code TEXT NOT NULL,
  section TEXT,
  subsection TEXT,
  account TEXT,
  amount REAL DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
