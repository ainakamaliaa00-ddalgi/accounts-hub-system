import express from 'express';
import cors from 'cors';
import multer from 'multer';
import xlsx from 'xlsx';
import { parse } from 'csv-parse/sync';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-before-going-live';
const DB_PATH = path.join(__dirname, 'accounts_hub_data.json');

app.use(cors());
app.use(express.json({ limit: '20mb' }));

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Accounts Hub API is running' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Accounts Hub API is healthy' });
});


const allowedBankKeys = {
  FTA: ['ALLIANCE 1 (992)', 'ALLIANCE 2 (111)', 'CIMB 1 (860)', 'CIMB 2 (801)', 'PBB', 'SWIPEY 1', 'SWIPEY 2'],
  FTAB: ['PBB', 'FD'],
  SN: ['PBB', 'HLB']
};

const modules = [
  { key: 'Claim', label: 'Claim', report_type: 'DAILY' },
  { key: 'DB', label: 'DB - Direct Bank In', report_type: 'DAILY' },
  { key: 'OP', label: 'OP - Online Purchase', report_type: 'DAILY' },
  { key: 'BS', label: 'BS / Bank Statements', report_type: 'BANK' },
  { key: 'TB', label: 'Trial Balance', report_type: 'TB' },
  { key: 'GL', label: 'General Ledger', report_type: 'GL' },
  { key: 'PL', label: 'Profit & Loss', report_type: 'PL' },
  { key: 'BALANCE_SHEET', label: 'Balance Sheet', report_type: 'BS' }
];

const permissions = {
  ADMIN: {
    Claim: { can_view: 1, can_add: 1, can_edit: 1, can_delete: 1, can_export: 1 },
    DB: { can_view: 1, can_add: 1, can_edit: 1, can_delete: 1, can_export: 1 },
    OP: { can_view: 1, can_add: 1, can_edit: 1, can_delete: 1, can_export: 1 },
    BS: { can_view: 1, can_add: 1, can_edit: 1, can_delete: 1, can_export: 1 },
    TB: { can_view: 1, can_add: 1, can_edit: 1, can_delete: 1, can_export: 1 },
    GL: { can_view: 1, can_add: 1, can_edit: 1, can_delete: 1, can_export: 1 }
  },
  BOD: {
    TB: { can_view: 1, can_add: 0, can_edit: 0, can_delete: 0, can_export: 1 },
    GL: { can_view: 1, can_add: 0, can_edit: 0, can_delete: 0, can_export: 1 },
    PL: { can_view: 1, can_add: 0, can_edit: 0, can_delete: 0, can_export: 1 },
    BALANCE_SHEET: { can_view: 1, can_add: 0, can_edit: 0, can_delete: 0, can_export: 1 }
  },
  SHAREHOLDER: {
    PL: { can_view: 1, can_add: 0, can_edit: 0, can_delete: 0, can_export: 0 },
    BALANCE_SHEET: { can_view: 1, can_add: 0, can_edit: 0, can_delete: 0, can_export: 0 }
  }
};

const tableMap = {
  Claim: 'claim_records',
  DB: 'db_records',
  OP: 'op_records',
  BS: 'bank_statement_records',
  TB: 'trial_balance_records',
  GL: 'general_ledger_records',
  PL: 'profit_loss_records',
  BALANCE_SHEET: 'balance_sheet_records'
};

function defaultDb() {
  return {
    users: [
      { id: 1, username: 'admin', display_name: 'Admin', role: 'ADMIN', password_hash: bcrypt.hashSync('admin123', 10) },
      { id: 2, username: 'bod', display_name: 'Board of Directors', role: 'BOD', password_hash: bcrypt.hashSync('bod123', 10) },
      { id: 3, username: 'shareholder', display_name: 'Shareholder', role: 'SHAREHOLDER', password_hash: bcrypt.hashSync('share123', 10) }
    ],
    accounts: ['FTA', 'FTAB', 'SN'],
    claim_records: [],
    db_records: [],
    op_records: [],
    bank_statement_records: [],
    trial_balance_records: [],
    general_ledger_records: [],
    profit_loss_records: [],
    balance_sheet_records: []
  };
}

let db = loadDb();

function loadDb() {
  if (!fs.existsSync(DB_PATH)) {
    const fresh = defaultDb();
    fs.writeFileSync(DB_PATH, JSON.stringify(fresh, null, 2));
    return fresh;
  }
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch (error) {
    const backup = `${DB_PATH}.broken-${Date.now()}`;
    fs.copyFileSync(DB_PATH, backup);
    const fresh = defaultDb();
    fs.writeFileSync(DB_PATH, JSON.stringify(fresh, null, 2));
    return fresh;
  }
}

function saveDb() {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function nextId(tableName) {
  const rows = db[tableName] || [];
  return rows.reduce((max, row) => Math.max(max, Number(row.id) || 0), 0) + 1;
}

function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Not logged in' });
  }
}

function can(req, moduleKey, action = 'view') {
  const rolePerms = permissions[req.user.role] || {};
  const perm = rolePerms[moduleKey];
  return perm && perm[`can_${action}`] === 1;
}

function normalizeMoney(value) {
  if (value === null || value === undefined || value === '') return 0;
  const s = String(value).replace(/RM/gi, '').replace(/,/g, '').trim();
  if (/^\(.+\)$/.test(s)) return -Number(s.slice(1, -1));
  return Number(s) || 0;
}

function monthFromDate(date) {
  const m = String(date || '').match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (!m) return '';
  const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return `${monthNames[Number(m[2]) - 1] || ''} ${String(m[3]).slice(-2)}`.trim();
}

function cleanHeader(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/[\n\r]+/g, ' ')
    .trim()
    .toLowerCase();
}

const headerAliases = {
  month: ['month', 'bulan'],
  for_field: ['for', 'for field', 'project', 'projek', 'purpose', 'claim for'],
  date: ['date', 'tarikh', 'transaction date'],
  ref_no: ['ref no', 'ref. no', 'reference no', 'reference number', 'reference', 'no rujukan', 'voucher no', 'jv no', 'pv no', 'doc no', 'document no'],
  seller: ['seller', 'supplier', 'vendor', 'payee', 'nama pembekal'],
  item: ['item', 'items', 'description item', 'particulars', 'details', 'keterangan'],
  category: ['category', 'kategori', 'type'],
  amount: ['amount', 'total amount', 'rm', 'jumlah', 'debit/(credit)', 'debit credit'],
  received_from: ['received from', 'payer', 'customer', 'from', 'nama pembayar'],
  description: ['description', 'details', 'particulars', 'transaction description', 'keterangan'],
  debit: ['debit', 'dr'],
  credit: ['credit', 'cr'],
  balance: ['balance', 'running balance', 'closing balance', 'baki'],
  supplier: ['supplier', 'seller', 'vendor'],
  payment_platform: ['payment platform', 'platform', 'payment method'],
  order_no: ['order no', 'order number', 'invoice no', 'invoice number'],
  code: ['code', 'account code', 'acct code'],
  account: ['account', 'account name', 'ledger account', 'description'],
  section: ['section', 'classification', 'group'],
  subsection: ['subsection', 'sub section', 'sub-category']
};

const moduleFields = {
  Claim: ['for_field', 'date', 'ref_no', 'seller', 'item', 'category', 'amount'],
  DB: ['date', 'ref_no', 'received_from', 'description', 'category', 'amount'],
  OP: ['month', 'date', 'supplier', 'item', 'category', 'amount', 'payment_platform', 'order_no'],
  BS: ['month', 'date', 'description', 'debit', 'credit', 'category', 'balance'],
  TB: ['code', 'account', 'debit', 'credit'],
  GL: ['date', 'ref_no', 'account', 'description', 'debit', 'credit', 'balance'],
  PL: ['section', 'account', 'amount'],
  BALANCE_SHEET: ['section', 'subsection', 'account', 'amount']
};

function headerScore(cells, moduleKey) {
  const wanted = moduleFields[moduleKey] || [];
  const cleaned = cells.map(cleanHeader);
  let score = 0;
  for (const field of wanted) {
    const aliases = headerAliases[field] || [field];
    if (cleaned.some(cell => aliases.some(alias => cell === alias || cell.includes(alias)))) score += 1;
  }
  return score;
}

function mapHeaders(cells, moduleKey) {
  const map = {};
  const wanted = moduleFields[moduleKey] || [];
  cells.forEach((cell, idx) => {
    const cleaned = cleanHeader(cell);
    for (const field of wanted) {
      if (map[field] !== undefined) continue;
      const aliases = headerAliases[field] || [field];
      if (aliases.some(alias => cleaned === alias || cleaned.includes(alias))) {
        map[field] = idx;
      }
    }
  });
  return map;
}

function objectRowsFromArrayRows(arrayRows, moduleKey, sheetName = '') {
  const nonEmptyRows = arrayRows.filter(row => row.some(value => String(value ?? '').trim() !== ''));
  if (!nonEmptyRows.length) return [];

  let bestHeaderIndex = -1;
  let bestScore = 0;
  const maxHeaderSearch = Math.min(nonEmptyRows.length, 80);
  for (let i = 0; i < maxHeaderSearch; i += 1) {
    const score = headerScore(nonEmptyRows[i], moduleKey);
    if (score > bestScore) {
      bestScore = score;
      bestHeaderIndex = i;
    }
  }

  // If no useful header row is found, fall back to the first row.
  // This helps clean CSVs and simple tables still import.
  if (bestHeaderIndex < 0 || bestScore < 2) bestHeaderIndex = 0;

  const headerMap = mapHeaders(nonEmptyRows[bestHeaderIndex], moduleKey);
  const headerNames = nonEmptyRows[bestHeaderIndex].map((cell, idx) => String(cell || `Column ${idx + 1}`).trim() || `Column ${idx + 1}`);
  const dataRows = nonEmptyRows.slice(bestHeaderIndex + 1);

  return dataRows.map(row => {
    const obj = { __sheetName: sheetName };
    for (const [field, idx] of Object.entries(headerMap)) obj[field] = row[idx] ?? '';
    // Keep original headers as fallback for clean CSV/object-style lookup.
    headerNames.forEach((header, idx) => { obj[header] = row[idx] ?? ''; });
    return obj;
  });
}

function shouldIncludeSheet(sheetName, moduleKey, selectedBank, sheetCount) {
  if (moduleKey !== 'BS') return true;
  if (!selectedBank || sheetCount === 1) return true;
  const s = cleanHeader(sheetName).replace(/[^a-z0-9]/g, '');
  const b = cleanHeader(selectedBank).replace(/[^a-z0-9]/g, '');
  if (s.includes(b) || b.includes(s)) return true;
  const bankHints = {
    'pbb': ['pbb', 'publicbank'],
    'fd': ['fd', 'fixeddeposit'],
    'hlb': ['hlb', 'hongleong'],
    'alliance1992': ['alliance1', '992'],
    'alliance2111': ['alliance2', '111'],
    'cimb1860': ['cimb1', '860'],
    'cimb2801': ['cimb2', '801'],
    'swipey1': ['swipey1'],
    'swipey2': ['swipey2']
  };
  const key = Object.keys(bankHints).find(k => b.includes(k) || bankHints[k].some(h => b.includes(h)));
  return key ? bankHints[key].some(h => s.includes(h)) : false;
}

function getRowsFromUpload(file, moduleKey, selectedBank = '') {
  const name = file.originalname.toLowerCase();
  if (name.endsWith('.csv')) {
    const parsed = parse(file.buffer.toString('utf8'), { columns: true, skip_empty_lines: true, trim: true, bom: true });
    return parsed.map(row => ({ ...row, __sheetName: 'CSV' }));
  }
  const workbook = xlsx.read(file.buffer, { type: 'buffer', cellDates: false });
  const allRows = [];
  workbook.SheetNames.forEach(sheetName => {
    if (!shouldIncludeSheet(sheetName, moduleKey, selectedBank, workbook.SheetNames.length)) return;
    const sheet = workbook.Sheets[sheetName];
    const arrayRows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false, blankrows: false });
    allRows.push(...objectRowsFromArrayRows(arrayRows, moduleKey, sheetName));
  });
  return allRows;
}

function pick(row, names) {
  const keys = Object.keys(row);
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== null && String(row[name]).trim() !== '') return row[name];
    const target = cleanHeader(name);
    const key = keys.find(k => cleanHeader(k) === target);
    if (key && String(row[key]).trim() !== '') return row[key];
  }
  for (const name of names) {
    const target = cleanHeader(name);
    const key = keys.find(k => cleanHeader(k).includes(target) || target.includes(cleanHeader(k)));
    if (key && String(row[key]).trim() !== '') return row[key];
  }
  return '';
}

function dateValue(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toLocaleDateString('en-GB');
  }
  const s = String(value).trim();
  if (!s) return '';
  // Excel serial date number
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const parsed = xlsx.SSF.parse_date_code(Number(s));
    if (parsed) return `${String(parsed.d).padStart(2, '0')}/${String(parsed.m).padStart(2, '0')}/${parsed.y}`;
  }
  return s;
}

function isBadText(value) {
  const s = String(value ?? '').trim();
  return !s || s === '#N/A' || s === '#VALUE!' || s === '-' || s.toUpperCase() === 'MYR';
}

function hasMeaningfulRecord(moduleKey, record) {
  if (moduleKey === 'Claim') return !isBadText(record.date) || !isBadText(record.ref_no) || !isBadText(record.seller) || !isBadText(record.item) || Number(record.amount || 0) !== 0;
  if (moduleKey === 'DB') return !isBadText(record.date) || !isBadText(record.ref_no) || !isBadText(record.received_from) || !isBadText(record.description) || Number(record.amount || 0) !== 0;
  if (moduleKey === 'OP') return !isBadText(record.date) || !isBadText(record.supplier) || !isBadText(record.item) || Number(record.amount || 0) !== 0;
  if (moduleKey === 'BS') return !isBadText(record.date) || !isBadText(record.description) || Number(record.debit || 0) !== 0 || Number(record.credit || 0) !== 0 || Number(record.balance || 0) !== 0;
  if (moduleKey === 'TB') return !isBadText(record.code) || !isBadText(record.account) || Number(record.debit || 0) !== 0 || Number(record.credit || 0) !== 0;
  if (moduleKey === 'GL') return !isBadText(record.date) || !isBadText(record.ref_no) || !isBadText(record.account) || !isBadText(record.description) || Number(record.debit || 0) !== 0 || Number(record.credit || 0) !== 0 || Number(record.balance || 0) !== 0;
  if (moduleKey === 'PL') return !isBadText(record.section) || !isBadText(record.account) || Number(record.amount || 0) !== 0;
  if (moduleKey === 'BALANCE_SHEET') return !isBadText(record.section) || !isBadText(record.subsection) || !isBadText(record.account) || Number(record.amount || 0) !== 0;
  return true;
}

function sortRows(moduleKey, rows) {
  const copy = [...rows];
  if (moduleKey === 'GL') return copy.sort((a, b) => String(a.account || '').localeCompare(String(b.account || '')) || String(a.ref_no || '').localeCompare(String(b.ref_no || '')) || String(a.date || '').localeCompare(String(b.date || '')));
  if (moduleKey === 'TB') return copy.sort((a, b) => String(a.code || '').localeCompare(String(b.code || '')));
  if (moduleKey === 'PL' || moduleKey === 'BALANCE_SHEET') return copy.sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0) || (Number(a.id) || 0) - (Number(b.id) || 0));
  return copy.sort((a, b) => String(a.ref_no || '').localeCompare(String(b.ref_no || '')) || String(a.date || '').localeCompare(String(b.date || '')) || (Number(a.id) || 0) - (Number(b.id) || 0));
}

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.users.find(u => u.username === username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  const token = jwt.sign({ id: user.id, username: user.username, displayName: user.display_name, role: user.role }, JWT_SECRET, { expiresIn: '12h' });
  res.json({ token, user: { username: user.username, displayName: user.display_name, role: user.role } });
});

app.get('/api/me', auth, (req, res) => res.json({ user: req.user }));

app.get('/api/navigation', auth, (req, res) => {
  const rolePerms = permissions[req.user.role] || {};
  const allowedModules = modules
    .filter(module => rolePerms[module.key]?.can_view === 1)
    .map(module => ({ ...module, ...rolePerms[module.key] }));
  res.json({ accounts: db.accounts, modules: allowedModules, banks: allowedBankKeys });
});

app.get('/api/records/:account/:moduleKey', auth, (req, res) => {
  const { account, moduleKey } = req.params;
  const tableName = tableMap[moduleKey];
  if (!tableName) return res.status(404).json({ error: 'Unknown module' });
  if (!can(req, moduleKey, 'view')) return res.status(403).json({ error: 'Access denied' });

  let rows = (db[tableName] || []).filter(row => row.account_code === account);
  if (moduleKey === 'BS' && req.query.bank) rows = rows.filter(row => row.bank_key === req.query.bank);
  if (['Claim', 'DB', 'OP', 'BS'].includes(moduleKey) && req.query.month && req.query.month !== 'ALL') {
    rows = rows.filter(row => row.month === req.query.month);
  }
  res.json({ rows: sortRows(moduleKey, rows) });
});

app.post('/api/import/:account/:moduleKey', auth, upload.single('file'), (req, res) => {
  const { account, moduleKey } = req.params;
  const tableName = tableMap[moduleKey];
  if (!tableName) return res.status(404).json({ error: 'Unknown module' });
  if (!can(req, moduleKey, 'add')) return res.status(403).json({ error: 'Access denied' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const bank = req.body.bank || '';
  const rawRows = getRowsFromUpload(req.file, moduleKey, bank);
  const rows = rawRows.filter(row => Object.values(row).some(value => String(value).trim() !== ''));
  const imported = [];
  let skipped = 0;

  rows.forEach((r, index) => {
    const date = dateValue(pick(r, ['date', 'Date', 'DATE']));
    const month = pick(r, ['month', 'Month', 'MONTH']) || monthFromDate(date) || String(r.__sheetName || '').toUpperCase();
    let record = { id: nextId(tableName), account_code: account, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };

    if (moduleKey === 'Claim') {
      record = { ...record, month, for_field: pick(r, ['for_field', 'For', 'For Field', 'Project']), date, ref_no: pick(r, ['ref_no', 'Ref No', 'Reference No', 'Reference Number', 'Voucher No', 'PV No', 'JV No']), seller: pick(r, ['seller', 'Seller', 'Supplier', 'Vendor']), item: pick(r, ['item', 'Item', 'Items', 'Particulars', 'Details', 'Description']), category: pick(r, ['category', 'Category', 'Kategori']), amount: normalizeMoney(pick(r, ['amount', 'Amount', 'RM', 'Jumlah', 'Total'])) };
    } else if (moduleKey === 'DB') {
      record = { ...record, month, date, ref_no: pick(r, ['ref_no', 'Ref No', 'Reference No', 'Reference Number', 'Voucher No', 'PV No', 'JV No']), received_from: pick(r, ['received_from', 'Received From', 'Payer', 'Customer', 'From']), description: pick(r, ['description', 'Description', 'Details', 'Particulars', 'Keterangan']), category: pick(r, ['category', 'Category', 'Kategori']), amount: normalizeMoney(pick(r, ['amount', 'Amount', 'RM', 'Jumlah', 'Total'])) };
    } else if (moduleKey === 'OP') {
      record = { ...record, month, date, supplier: pick(r, ['supplier', 'Supplier', 'Seller', 'Vendor']), item: pick(r, ['item', 'Item', 'Items', 'Particulars', 'Details', 'Description']), category: pick(r, ['category', 'Category', 'Kategori']), amount: normalizeMoney(pick(r, ['amount', 'Amount', 'RM', 'Jumlah', 'Total'])), payment_platform: pick(r, ['payment_platform', 'Payment Platform', 'Platform', 'Payment Method']), order_no: pick(r, ['order_no', 'Order No', 'Order Number', 'Invoice No']) };
    } else if (moduleKey === 'BS') {
      record = { ...record, bank_key: bank, month, date, description: pick(r, ['description', 'Description', 'Details', 'Particulars', 'Keterangan']), debit: normalizeMoney(pick(r, ['debit', 'Debit', 'DR'])), credit: normalizeMoney(pick(r, ['credit', 'Credit', 'CR'])), category: pick(r, ['category', 'Category', 'Kategori']), balance: normalizeMoney(pick(r, ['balance', 'Balance', 'Running Balance', 'Baki'])) };
    } else if (moduleKey === 'TB') {
      record = { ...record, code: pick(r, ['code', 'Code', 'CODE', 'Account Code']), account: pick(r, ['account', 'Account', 'ACCOUNT', 'Account Name']), debit: normalizeMoney(pick(r, ['Debit', 'DEBIT'])), credit: normalizeMoney(pick(r, ['Credit', 'CREDIT'])) };
    } else if (moduleKey === 'GL') {
      record = { ...record, date, ref_no: pick(r, ['ref_no', 'Ref No', 'Reference No', 'Reference Number', 'Voucher No', 'PV No', 'JV No']), account: pick(r, ['account', 'Account', 'Account Name']), description: pick(r, ['description', 'Description', 'Details', 'Particulars', 'Keterangan']), debit: normalizeMoney(pick(r, ['debit', 'Debit', 'DR'])), credit: normalizeMoney(pick(r, ['credit', 'Credit', 'CR'])), balance: normalizeMoney(pick(r, ['balance', 'Balance', 'Running Balance', 'Baki'])) };
    } else if (moduleKey === 'PL') {
      record = { ...record, section: pick(r, ['section', 'Section', 'Classification', 'Group']), account: pick(r, ['account', 'Account', 'Account Name']), amount: normalizeMoney(pick(r, ['amount', 'Amount', 'RM', 'Jumlah', 'Total'])), sort_order: index };
    } else if (moduleKey === 'BALANCE_SHEET') {
      record = { ...record, section: pick(r, ['section', 'Section', 'Classification', 'Group']), subsection: pick(r, ['subsection', 'Subsection', 'Sub Section', 'Sub-Category']), account: pick(r, ['account', 'Account', 'Account Name']), amount: normalizeMoney(pick(r, ['amount', 'Amount', 'RM', 'Jumlah', 'Total'])), sort_order: index };
    }

    if (!hasMeaningfulRecord(moduleKey, record)) {
      skipped += 1;
      return;
    }
    db[tableName].push(record);
    imported.push(record);
  });

  saveDb();
  res.json({ imported: imported.length, skipped, scanned: rows.length });
});

app.delete('/api/records/:account/:moduleKey', auth, (req, res) => {
  const { account, moduleKey } = req.params;
  const tableName = tableMap[moduleKey];
  if (!tableName) return res.status(404).json({ error: 'Unknown module' });
  if (!can(req, moduleKey, 'delete')) return res.status(403).json({ error: 'Access denied' });

  const before = db[tableName].length;
  db[tableName] = db[tableName].filter(row => {
    if (row.account_code !== account) return true;
    if (moduleKey === 'BS' && req.query.bank) return row.bank_key !== req.query.bank;
    return false;
  });
  const deleted = before - db[tableName].length;
  saveDb();
  res.json({ deleted });
});

app.listen(process.env.PORT || 4000, () => {
  console.log('Accounts Hub API running on port', process.env.PORT || 4000);
  console.log('This version uses a simple JSON data file, so no Python/build tools are needed.');
});
