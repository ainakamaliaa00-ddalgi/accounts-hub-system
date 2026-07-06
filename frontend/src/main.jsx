import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { LogOut, Upload, Search, Building2, FileSpreadsheet, Shield } from 'lucide-react';
import './style.css';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '');
const API = API_BASE.endsWith('/api') ? API_BASE : `${API_BASE}/api`;
const months = ['ALL','JAN 26','FEB 26','MAR 26','APR 26','MAY 26','JUN 26','JUL 26','AUG 26','SEP 26','OCT 26','NOV 26','DEC 26'];
const moduleLabels = { Claim:'Claim', DB:'DB - Direct Bank In', OP:'OP - Online Purchase', BS:'BS / Bank Statements', TB:'Trial Balance', GL:'General Ledger', PL:'Profit & Loss', BALANCE_SHEET:'Balance Sheet' };
const accountInitials = { FTA:'A', FTAB:'F', SN:'S' };
function money(n){ const num=Number(n||0); return num<0?`(${Math.abs(num).toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2})})`:num.toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function authHeaders(token){ return { Authorization:`Bearer ${token}` }; }
function Login({setSession}){
  const [username,setUsername]=useState('admin'),[password,setPassword]=useState('admin123'),[err,setErr]=useState('');
  async function submit(e){ e.preventDefault(); setErr(''); const res=await fetch(`${API}/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})}); const data=await res.json(); if(!res.ok) return setErr(data.error||'Login failed'); localStorage.setItem('accountsHubToken',data.token); setSession(data); }
  return <div className="login"><form onSubmit={submit} className="login-card"><h1>Accounts Hub</h1><p>Login to continue</p>{err&&<div className="err">{err}</div>}<label>Username<input value={username} onChange={e=>setUsername(e.target.value)}/></label><label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)}/></label><button>Login</button><small>Demo: admin/admin123, bod/bod123, shareholder/share123</small></form></div>
}
function App(){
  const [session,setSession]=useState(null),[nav,setNav]=useState(null),[account,setAccount]=useState('FTA'),[moduleKey,setModuleKey]=useState('Claim'),[bank,setBank]=useState(''),[rows,setRows]=useState([]),[month,setMonth]=useState('ALL'),[q,setQ]=useState('');
  const token=localStorage.getItem('accountsHubToken');
  useEffect(()=>{ if(token) fetch(`${API}/me`,{headers:authHeaders(token)}).then(r=>r.ok?r.json():Promise.reject()).then(d=>setSession({user:d.user,token})).catch(()=>localStorage.removeItem('accountsHubToken'));},[]);
  useEffect(()=>{ if(session) fetch(`${API}/navigation`,{headers:authHeaders(session.token)}).then(r=>r.json()).then(d=>{setNav(d); if(d.modules?.[0]) setModuleKey(d.modules[0].key);});},[session]);
  useEffect(()=>{ if(session&&nav) loadRows(); },[session,account,moduleKey,bank,month]);
  const allowedModules=nav?.modules||[];
  function logout(){ localStorage.removeItem('accountsHubToken'); location.reload(); }
  async function loadRows(){ const params=new URLSearchParams(); if(month!=='ALL') params.set('month',month); if(moduleKey==='BS'&&bank) params.set('bank',bank); const res=await fetch(`${API}/records/${account}/${moduleKey}?${params}`,{headers:authHeaders(session.token)}); const data=await res.json(); setRows(data.rows||[]); }
  async function importFile(e){
    const file=e.target.files[0];
    if(!file) return;
    const form=new FormData();
    form.append('file',file);
    if(moduleKey==='BS') form.append('bank',bank||nav.banks[account]?.[0]||'');
    const res=await fetch(`${API}/import/${account}/${moduleKey}`,{method:'POST',headers:authHeaders(session.token),body:form});
    const data=await res.json();
    e.target.value='';
    alert(res.ok?`Imported ${data.imported} rows${data.skipped?` (${data.skipped} blank/template rows skipped)`:''}`:data.error);
    loadRows();
  }
  async function clearCurrentModule(){
    const label = `${account} / ${moduleLabels[moduleKey]}${moduleKey==='BS'&&bank?` / ${bank}`:''}`;
    if(!confirm(`Clear all records for ${label}? This is useful before re-importing a corrected file.`)) return;
    const params=new URLSearchParams();
    if(moduleKey==='BS'&&bank) params.set('bank',bank);
    const res=await fetch(`${API}/records/${account}/${moduleKey}?${params}`,{method:'DELETE',headers:authHeaders(session.token)});
    const data=await res.json();
    alert(res.ok?`Deleted ${data.deleted} rows`:data.error);
    loadRows();
  }
  const filtered=useMemo(()=> rows.filter(r=>Object.values(r).join(' ').toLowerCase().includes(q.toLowerCase())),[rows,q]);
  const activePerm=allowedModules.find(m=>m.key===moduleKey)||{};
  if(!session) return <Login setSession={setSession}/>;
  if(!nav) return <div className="loading">Loading...</div>;
  return <div className="shell"><aside><div className="brand"><Shield/><div><h2>Accounts Hub</h2><span>{session.user.displayName} · {session.user.role}</span></div></div><p className="side-label">Account</p>{nav.accounts.map(a=><button key={a} className={a===account?'active account':'account'} onClick={()=>{setAccount(a);setBank('')}}><span className="avatar">{accountInitials[a]}</span>{a}</button>)}<p className="side-label">Category</p>{allowedModules.map(m=><button key={m.key} className={m.key===moduleKey?'active module':'module'} onClick={()=>{setModuleKey(m.key);setBank('')}}><FileSpreadsheet size={16}/>{m.label}</button>)}{moduleKey==='BS'&&<div className="banks">{(nav.banks[account]||[]).map(b=><button className={bank===b?'active bank':'bank'} onClick={()=>setBank(b)} key={b}>{b}</button>)}</div>}<button className="logout" onClick={logout}><LogOut size={16}/> Logout</button></aside><main><header><div><small>Current View</small><h1>{account} / {moduleLabels[moduleKey]} {bank?`/ ${bank}`:''}</h1></div><div className="user-pill">{session.user.displayName}</div></header><Kpis moduleKey={moduleKey} rows={filtered} account={account}/><section className="toolbar">{['Claim','DB','OP','BS'].includes(moduleKey)&&<select value={month} onChange={e=>setMonth(e.target.value)}>{months.map(m=><option key={m}>{m}</option>)}</select>}<div className="search"><Search size={16}/><input placeholder="Search records..." value={q} onChange={e=>setQ(e.target.value)}/></div>{activePerm.can_delete===1&&<button className="clear-btn" onClick={clearCurrentModule}>Clear Current</button>}{activePerm.can_add===1&&<label className="import"><Upload size={16}/> Import CSV/Excel<input type="file" accept=".csv,.xlsx,.xls" onChange={importFile}/></label>}</section><Report moduleKey={moduleKey} rows={filtered}/></main></div>
}
function Kpis({moduleKey,rows,account}){
  if(moduleKey==='BALANCE_SHEET') return null;
  const totalAmount=rows.reduce((s,r)=>s+Number(r.amount||r.debit||0)-Number(r.credit && moduleKey==='PL'?0:0),0);
  const debit=rows.reduce((s,r)=>s+Number(r.debit||0),0), credit=rows.reduce((s,r)=>s+Number(r.credit||0),0);
  const netPL = moduleKey==='PL' ? (rows.find(r=>String(r.account||'').toUpperCase().includes('NET PROFIT'))?.amount || totalAmount) : totalAmount;
  return <div className="kpis"><div className="kpi"><span>#</span><b>{rows.length}</b><small>Total Rows</small></div>{moduleKey==='PL'?<div className="kpi"><span>RM</span><b>{money(netPL)}</b><small>Net Profit/(Loss)</small></div>:<div className="kpi"><span>RM</span><b>{money(moduleKey==='TB'||moduleKey==='GL'?debit:totalAmount)}</b><small>{moduleKey==='TB'||moduleKey==='GL'?'Total Debit':'Total Amount'}</small></div>}{(moduleKey==='TB'||moduleKey==='GL')&&<div className="kpi"><span>RM</span><b>{money(credit)}</b><small>Total Credit</small></div>}<div className="kpi"><span><Building2 size={14}/></span><b>{account}</b><small>Account</small></div></div>
}
function Report({moduleKey,rows}){
  if(moduleKey==='PL') return <Statement title="Profit & Loss Account" rows={rows} />;
  if(moduleKey==='BALANCE_SHEET') return <Statement title="Balance Sheet" rows={rows} balance />;
  if(moduleKey==='TB') return <Table rows={rows} cols={['code','account','debit','credit']} moneyCols={['debit','credit']} />;
  if(moduleKey==='GL') return <Table rows={rows} cols={['date','ref_no','account','description','debit','credit','balance']} moneyCols={['debit','credit','balance']} />;
  if(moduleKey==='BS') return <Table rows={rows} cols={['month','date','description','debit','credit','category','balance']} moneyCols={['debit','credit','balance']} />;
  if(moduleKey==='Claim') return <Table rows={rows} cols={['for_field','date','ref_no','seller','item','category','amount']} moneyCols={['amount']} />;
  if(moduleKey==='DB') return <Table rows={rows} cols={['date','ref_no','received_from','description','category','amount']} moneyCols={['amount']} />;
  return <Table rows={rows} cols={Object.keys(rows[0]||{})} />;
}
function Table({rows,cols,moneyCols=[]}){ return <div className="card"><table><thead><tr>{cols.map(c=><th key={c}>{c.replaceAll('_',' ').toUpperCase()}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i}>{cols.map(c=><td key={c} className={moneyCols.includes(c)?'num':''}>{moneyCols.includes(c)?money(r[c]):r[c]}</td>)}</tr>)}</tbody></table></div> }
function Statement({title,rows,balance}){ return <div className="statement card"><h2>{title}</h2><h3>RM</h3>{rows.map((r,i)=><div key={i} className={(r.account||'').toLowerCase().includes('total')?'line total':'line'}><span className={r.section&&!r.account?'section':''}>{r.subsection||r.account||r.section}</span><b>{money(r.amount)}</b></div>)}</div> }

createRoot(document.getElementById('root')).render(<App/>);
