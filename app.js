/* EthosGuard — real, on-device AI governance workspace.
   Your data stays in this browser (localStorage). Live lookups: Hugging Face, PyPI, npm (public, keyless).
   Free AI: Pollinations (keyless) through ai-helper.js. */
'use strict';
const TEST = new URLSearchParams(location.search).get('ns') === 'test';
const KEY = 'ethosguard-v1' + (TEST ? '-test' : '');
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => new Date().toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2, 10);
const fmt = (n, d = 3) => (n == null || !isFinite(n)) ? '—' : (+n).toFixed(d);

const BLANK = { org: '', systems: [], policies: [], incidents: [], audit: [], nist: {}, tests: [], packages: [], models: [], xai: {}, bounds: { di: 0.8, psi: 0.25, eo: 0.1 } };
let S;
function load() { try { S = Object.assign(structuredClone(BLANK), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { S = structuredClone(BLANK); } S.bounds = Object.assign({}, BLANK.bounds, S.bounds); }
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Could not save — browser storage is full. Export a backup and clear old tests.'); } }
function log(event, system) { S.audit.unshift({ at: new Date().toISOString(), event, system: system || '', actor: S.user || 'You' }); S.audit = S.audit.slice(0, 2000); save(); }
function toast(t) { let el = $('#toast'); if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); } el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 3500); }
const sysName = id => (S.systems.find(s => s.id === id) || {}).name || '';
function sysOptions(sel, any) { return (any ? '<option value="">— not linked to a system —</option>' : '') + S.systems.map(s => `<option value="${s.id}" ${s.id === sel ? 'selected' : ''}>${esc(s.name)}</option>`).join(''); }
function download(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type || 'text/plain' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
const csvCell = v => { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };

function badge(status) {
  const s = (status || '').toLowerCase(); let cls = 'b-muted';
  if (/compliant|approved|closed|active|pass|ok|low|minimal|audited|cleared|complete|stable|permissive|done/.test(s)) cls = 'b-ok';
  else if (/partial|conditional|medium|limited|mitigat|draft|review|warn|watch|moderate|weak|unknown/.test(s)) cls = 'b-warn';
  else if (/high|risk|open|fail|critical|prohibit|significant|copyleft|strong|not found|overdue/.test(s)) cls = 'b-bad';
  else if (/info|new/.test(s)) cls = 'b-info';
  return `<span class="badge ${cls}">${esc(status)}</span>`;
}
const meter = (score, color) => `<div class="meter"><span style="width:${Math.min(100, Math.max(0, score))}%;background:${color}"></span></div>`;
const kv = (k, v) => `<div class="kv"><b>${k}</b><div>${v}</div></div>`;
const empty = (t, btn) => `<div class="empty"><p>${t}</p>${btn || ''}</div>`;

/* Risk rules: EU AI Act Annex III / Art. 5 + Colorado SB24-205 consequential decisions */
const DOMAINS = [
  ['employment', 'Hiring, firing, promotion or work allocation', 'High', true],
  ['credit', 'Credit scoring / lending', 'High', true],
  ['insurance', 'Life or health insurance pricing / eligibility', 'High', true],
  ['education', 'Education admission, grading or proctoring', 'High', true],
  ['housing', 'Housing / tenant screening', 'Limited', true],
  ['health', 'Healthcare decisions or medical device', 'High', true],
  ['essential', 'Access to essential public services or benefits', 'High', true],
  ['legal', 'Legal services / justice / courts', 'High', true],
  ['law', 'Law enforcement', 'High', false],
  ['migration', 'Migration, asylum or border control', 'High', false],
  ['biometric', 'Biometric identification or emotion recognition', 'High', false],
  ['infra', 'Critical infrastructure safety (energy, water, traffic)', 'High', false],
  ['social', 'Social scoring of people by public authorities', 'Prohibited', false],
  ['manip', 'Subliminal manipulation or exploiting vulnerable groups', 'Prohibited', false],
  ['chatbot', 'Chatbot / talks with people', 'Limited', false],
  ['genai', 'Generates images, audio, video or text for the public', 'Limited', false],
  ['internal', 'Internal productivity, analytics, spam filter, search', 'Minimal', false],
  ['other', 'Something else', 'Minimal', false],
];
const RANK = { Minimal: 0, Limited: 1, High: 2, Prohibited: 3 };
function assess(sys) {
  let tier = 'Minimal', colorado = false; const why = [];
  (sys.domains || []).forEach(d => { const D = DOMAINS.find(x => x[0] === d); if (!D) return; if (RANK[D[2]] > RANK[tier]) tier = D[2]; if (D[3]) colorado = true; why.push(D[1]); });
  colorado = colorado && !!sys.decides;
  const risk = tier === 'Prohibited' || tier === 'High' ? 'High' : tier === 'Limited' || colorado ? 'Medium' : 'Low';
  return { tier, colorado, risk: colorado && risk !== 'High' ? 'High' : risk, why };
}
function sysEvidence(id) {
  const t = S.tests.filter(x => x.system === id);
  const last = k => t.filter(x => x.kind === k).sort((a, b) => b.at.localeCompare(a.at))[0];
  return { bias: last('bias'), drift: last('drift'), integrity: last('integrity'), privacy: last('privacy'), model: S.models.find(m => m.system === id) };
}
function testStatus(t) {
  if (!t) return null;
  if (t.kind === 'bias') return t.result.di == null ? 'Info' : t.result.di >= S.bounds.di && (t.result.eo == null || t.result.eo <= S.bounds.eo) ? 'Pass' : 'Fail';
  if (t.kind === 'drift') return t.result.max < 0.1 ? 'Stable' : t.result.max <= S.bounds.psi ? 'Moderate' : 'Significant';
  if (t.kind === 'integrity') return t.result.issues ? 'Watch' : 'Pass';
  if (t.kind === 'privacy') return t.result.total ? 'Watch' : 'Pass';
  return 'Info';
}

/* NIST AI RMF 1.0 — selected subcategories, paraphrased */
const NIST = [
  ['GOVERN', 'GV-1.1', 'Legal and regulatory requirements for AI are understood, managed and documented', 'compliance'],
  ['GOVERN', 'GV-1.2', 'Trustworthy-AI characteristics are written into policies and procedures', 'policies'],
  ['GOVERN', 'GV-1.6', 'There is an inventory of the AI systems in use', 'registry'],
  ['GOVERN', 'GV-2.1', 'Roles, responsibilities and lines of communication for AI risk are documented', 'registry'],
  ['GOVERN', 'GV-3.2', 'Policies define human oversight roles for AI systems', 'policies'],
  ['GOVERN', 'GV-4.3', 'Practices exist for testing, finding incidents and sharing what was learned', 'safety'],
  ['GOVERN', 'GV-5.1', 'Feedback from people affected by the AI is collected and considered', 'policies'],
  ['GOVERN', 'GV-6.1', 'Risks from third-party models, data and software are addressed', 'provenance'],
  ['MAP', 'MP-1.1', 'Intended purpose, context of use and expected users are documented', 'registry'],
  ['MAP', 'MP-2.1', 'The task and method the AI uses (e.g., classifier, LLM) are defined', 'registry'],
  ['MAP', 'MP-3.1', 'Expected benefits of the system are documented', 'registry'],
  ['MAP', 'MP-4.1', 'Legal risks of components (licenses, IP, data rights) are mapped', 'provenance'],
  ['MAP', 'MP-5.1', 'Likelihood and size of possible harms to people are identified', 'registry'],
  ['MEASURE', 'MS-1.1', 'Metrics and methods for measuring the main risks are chosen', 'bias'],
  ['MEASURE', 'MS-2.5', 'The system is shown to be valid and reliable for its use', 'xai'],
  ['MEASURE', 'MS-2.7', 'Security and resilience (incl. data poisoning) are evaluated', 'poisoning'],
  ['MEASURE', 'MS-2.9', 'The model is explained and its output can be interpreted', 'xai'],
  ['MEASURE', 'MS-2.10', 'Privacy risk is examined and documented', 'privacy'],
  ['MEASURE', 'MS-2.11', 'Fairness and bias are evaluated and results documented', 'bias'],
  ['MEASURE', 'MS-3.1', 'Emerging risks such as data drift are tracked over time', 'drift'],
  ['MANAGE', 'MG-1.1', 'A decision is recorded on whether the system meets its purpose and should go ahead', 'registry'],
  ['MANAGE', 'MG-2.4', 'There is a way to override, pause or switch the system off', 'safety'],
  ['MANAGE', 'MG-3.1', 'Risks from third-party resources are monitored regularly', 'provenance'],
  ['MANAGE', 'MG-4.1', 'Post-deployment monitoring is planned and running', 'drift'],
  ['MANAGE', 'MG-4.3', 'Incidents and errors are tracked and communicated', 'safety'],
];
function nistAuto(code) {
  const has = k => S.tests.some(t => t.kind === k);
  return ({ 'GV-1.6': S.systems.length > 0, 'MP-1.1': S.systems.some(s => s.purpose), 'GV-2.1': S.systems.some(s => s.owner), 'MS-2.11': has('bias'), 'MS-3.1': has('drift'), 'MS-2.10': has('privacy'), 'MS-2.7': has('integrity'), 'GV-6.1': S.packages.length > 0 || S.models.length > 0, 'MP-4.1': S.packages.length > 0 || S.models.length > 0, 'MG-4.3': S.incidents.length > 0, 'GV-1.2': S.policies.some(p => p.status === 'Active'), 'MS-2.9': has('influence') })[code] || false;
}
const nistPct = () => Math.round(100 * NIST.filter(n => S.nist[n[1]]).length / NIST.length);

/* Policy starter templates */
const TEMPLATES = [
  ['Acceptable AI Use', 'All staff', 'Purpose: set rules for using AI tools at work.\n\n1. Approved tools only: staff may use AI tools listed in the AI system registry.\n2. No confidential, customer or personal data goes into public AI tools unless the tool is approved for that data.\n3. A person reviews AI output before it is sent to customers or used in a decision about a person.\n4. AI-generated content that is published must be labeled where the law requires it.\n5. Report problems (wrong, harmful or biased output) to the AI governance owner within 2 business days.\n6. Breaking this policy may lead to loss of tool access.'],
  ['High-Risk AI System Review', 'Risk / Legal', 'Purpose: review AI systems that make or help make consequential decisions about people (jobs, credit, housing, insurance, education, health, legal, essential services).\n\n1. Register the system in the AI registry before launch.\n2. Complete an impact assessment: purpose, data, people affected, known risks, mitigations.\n3. Run a bias test before launch and at least every 12 months, and after major changes.\n4. Give people notice that AI is used, the main reasons for an adverse decision, and a way to correct data and appeal to a human.\n5. Sign-off required from the system owner and legal before launch.\n6. Keep records for at least 3 years.'],
  ['Bias Testing Standard', 'Model owners', 'Purpose: measure and limit unfair outcomes.\n\n1. Test selection rates by group for every protected attribute the data allows (e.g., sex, race/ethnicity, age band).\n2. Pass bar: disparate impact ratio of at least 0.80 (four-fifths rule) and equal-opportunity gap no more than 0.10, unless legal approves a documented exception.\n3. Failing systems may not expand use until mitigated and retested.\n4. Store each test result in the audit trail.'],
  ['Human Oversight', 'Ops leads', 'Purpose: keep people in control.\n\n1. Every AI system names an accountable owner.\n2. High-risk systems have a human review step before any adverse decision is final.\n3. Reviewers are trained and have authority to override the AI.\n4. There is a documented way to pause or switch off each system.\n5. Overrides and the reasons are logged.'],
  ['AI Incident Response', 'Security', 'Purpose: respond fast when AI causes or nearly causes harm.\n\n1. Anyone can report an AI incident to the governance owner.\n2. Triage within 1 business day: severity (low / medium / high), people affected, whether to pause the system.\n3. High severity: pause or limit the system, notify legal, notify affected people and regulators where required by law.\n4. Record root cause and fix; close only after retest.\n5. Review incidents quarterly.'],
  ['Data Minimization for AI', 'Privacy', 'Purpose: use only the data needed.\n\n1. Each AI system lists the data fields it uses and why.\n2. Remove fields that are not needed; never use sensitive data (health, biometrics, precise location, children\'s data) without a documented need and legal review.\n3. Scan training and prompt data for personal information before use and redact where possible.\n4. Set retention periods and delete data when they end.'],
  ['Third-Party AI & Open-Source Models', 'Procurement / Engineering', 'Purpose: manage risk from outside models, datasets and packages.\n\n1. Record the source, version and license of every model, dataset and package.\n2. Copyleft (GPL/AGPL/LGPL) and unknown licenses need engineering + legal review before shipping.\n3. Prefer models with a model card that states training data and limits.\n4. Re-check vendors and licenses at least once a year.'],
];

/* CSV */
function parseCSV(text, max = 50000) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); f = ''; if (row.length > 1 || row[0] !== '') rows.push(row); row = []; if (rows.length > max) break; }
    else f += c;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  if (!rows.length) throw new Error('The file is empty.');
  const head = rows.shift().map((h, i) => h.trim() || 'col' + (i + 1));
  if (!rows.length) throw new Error('The file has a header but no rows.');
  return { head, rows, truncated: rows.length >= max };
}
const readFile = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('Could not read file')); r.readAsText(f); });
const isNum = v => v !== '' && v != null && isFinite(+v);
function colIsNum(D, c) { let n = 0, k = 0; for (const r of D.rows.slice(0, 500)) { const v = (r[c] || '').trim(); if (v === '') continue; k++; if (isNum(v)) n++; } return k > 0 && n / k > 0.95; }
function uniques(D, c, lim = 50) { const m = new Map(); for (const r of D.rows) { const v = (r[c] || '').trim(); m.set(v, (m.get(v) || 0) + 1); if (m.size > lim) break; } return [...m.entries()].sort((a, b) => b[1] - a[1]); }
const colSelect = (id, D, sel, blank) => `<select id="${id}">${blank ? `<option value="">${blank}</option>` : ''}${D.head.map((h, i) => `<option value="${i}" ${i === sel ? 'selected' : ''}>${esc(h)}</option>`).join('')}</select>`;
const guess = (D, re) => { const i = D.head.findIndex(h => re.test(h)); return i < 0 ? 0 : i; };
const loaded = {};
function fileBox(id, label) { return `<label class="file"><input type="file" accept=".csv,text/csv" id="${id}"><span>📄 ${label}</span></label>`; }

/* Metrics */
function biasTest(D, g, p, pos, y, ypos) {
  const G = new Map();
  for (const r of D.rows) {
    const k = (r[g] || '').trim() || '(blank)'; const o = G.get(k) || { n: 0, sel: 0, tp: 0, P: 0, fp: 0, N: 0 }; o.n++;
    const s = (r[p] || '').trim() === pos; if (s) o.sel++;
    if (y != null) { const a = (r[y] || '').trim() === ypos; if (a) { o.P++; if (s) o.tp++; } else { o.N++; if (s) o.fp++; } }
    G.set(k, o);
  }
  const groups = [...G.entries()].map(([k, o]) => ({ group: k, n: o.n, rate: o.sel / o.n, tpr: o.P ? o.tp / o.P : null, fpr: o.N ? o.fp / o.N : null })).sort((a, b) => b.n - a.n);
  const big = groups.filter(x => x.n >= 20); const use = big.length >= 2 ? big : groups;
  const rates = use.map(x => x.rate), maxR = Math.max(...rates), minR = Math.min(...rates);
  const tprs = use.map(x => x.tpr).filter(x => x != null);
  return { groups: groups.slice(0, 60), di: use.length >= 2 && maxR > 0 ? minR / maxR : null, dpd: use.length >= 2 ? maxR - minR : null, eo: tprs.length >= 2 ? Math.max(...tprs) - Math.min(...tprs) : null, small: big.length >= 2 ? groups.filter(x => x.n < 20).map(x => x.group) : [] };
}
function psi(base, cur, numeric) {
  const eps = 1e-4; let bins;
  if (numeric) {
    const b = base.filter(isNum).map(Number).sort((x, y) => x - y), c = cur.filter(isNum).map(Number);
    if (b.length < 10 || c.length < 10) return null;
    const cuts = [...new Set([1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => b[Math.floor(i * b.length / 10)]))];
    const idx = v => { let i = 0; while (i < cuts.length && v > cuts[i]) i++; return i; };
    const cb = Array(cuts.length + 1).fill(0), cc = Array(cuts.length + 1).fill(0);
    b.forEach(v => cb[idx(v)]++); c.forEach(v => cc[idx(v)]++);
    bins = cb.map((n, i) => [n / b.length, cc[i] / c.length]);
  } else {
    const cats = new Set([...base, ...cur]); if (cats.size > 200) return null;
    const cnt = a => { const m = new Map(); a.forEach(v => m.set(v, (m.get(v) || 0) + 1)); return m; };
    const mb = cnt(base), mc = cnt(cur); bins = [...cats].map(k => [(mb.get(k) || 0) / base.length, (mc.get(k) || 0) / cur.length]);
  }
  return bins.reduce((s, [e, a]) => { e = Math.max(e, eps); a = Math.max(a, eps); return s + (a - e) * Math.log(a / e); }, 0);
}
const INJECT = /ignore (all |any )?(previous|prior|above) instructions|disregard (the )?(system|previous)|you are now|<\s*script|javascript:|\{\{.*\}\}|\bsystem\s*:|\[INST\]|<\|im_start\|>|BEGIN PROMPT|jailbreak/i;
function integrity(D, label) {
  const n = D.rows.length, issues = [];
  const missing = D.head.map((h, i) => ({ col: h, pct: D.rows.filter(r => (r[i] || '').trim() === '').length / n })).filter(x => x.pct > 0);
  const seen = new Set(); let dups = 0; D.rows.forEach(r => { const k = r.join('\u0001'); if (seen.has(k)) dups++; else seen.add(k); });
  const constant = D.head.filter((h, i) => uniques(D, i, 2).length === 1);
  const outliers = [];
  D.head.forEach((h, i) => { if (!colIsNum(D, i)) return; const v = D.rows.map(r => r[i]).filter(isNum).map(Number); if (v.length < 30) return; const m = v.reduce((a, b) => a + b, 0) / v.length; const sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length); if (!sd) return; const k = v.filter(x => Math.abs(x - m) / sd > 4).length; if (k) outliers.push({ col: h, count: k }); });
  const inject = []; D.rows.forEach((r, ri) => r.forEach((c, ci) => { if (inject.length < 50 && c && c.length > 6 && INJECT.test(c)) inject.push({ row: ri + 2, col: D.head[ci], text: c.slice(0, 80) }); }));
  let conflicts = 0, balance = null;
  if (label != null) {
    const m = new Map(); D.rows.forEach(r => { const k = r.filter((_, i) => i !== label).join('\u0001'); const y = (r[label] || '').trim(); const s = m.get(k) || new Set(); s.add(y); m.set(k, s); });
    m.forEach(s => { if (s.size > 1) conflicts++; });
    balance = uniques(D, label, 30).map(([k, c]) => ({ value: k, pct: c / n }));
  }
  if (dups) issues.push(dups + ' duplicate rows'); if (constant.length) issues.push(constant.length + ' constant columns');
  if (missing.some(x => x.pct > 0.2)) issues.push('columns more than 20% empty'); if (inject.length) issues.push(inject.length + ' cells look like prompt/script injection');
  if (outliers.length) issues.push('extreme outliers in ' + outliers.length + ' columns');
  if (conflicts) issues.push(conflicts + ' identical rows with different labels (possible label flips)');
  if (balance && balance.length > 1 && balance[balance.length - 1].pct < 0.05) issues.push('rare class under 5%');
  return { n, missing, dups, constant, outliers, inject, conflicts, balance, issues: issues.length, list: issues };
}
const PII = [
  ['Email', /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi],
  ['US SSN', /\b(?!000|666|9\d\d)\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/g],
  ['Card number', /\b(?:\d[ -]?){12,18}\d\b/g, s => { const d = s.replace(/\D/g, ''); if (d.length < 13 || d.length > 19) return false; let sum = 0, alt = false; for (let i = d.length - 1; i >= 0; i--) { let x = +d[i]; if (alt) { x *= 2; if (x > 9) x -= 9; } sum += x; alt = !alt; } return sum % 10 === 0; }],
  ['Phone', /(?:\+?1[ .-]?)?\(?\b[2-9]\d{2}\)?[ .-]?\d{3}[ .-]?\d{4}\b/g],
  ['IP address', /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g],
  ['Street address', /\b\d{1,6}\s+(?:[A-Z][a-z]+\s){1,3}(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Dr|Drive|Ln|Lane|Ct|Court|Way|Pl|Place)\b\.?/g],
  ['Date (possible DOB)', /\b(?:0?[1-9]|1[0-2])[/-](?:0?[1-9]|[12]\d|3[01])[/-](?:19|20)\d{2}\b/g],
];
function piiScan(text) {
  const found = {}; let red = text;
  PII.forEach(([name, re, ok]) => { red = red.replace(re, m => { if (ok && !ok(m)) return m; found[name] = (found[name] || 0) + 1; return '[' + name.toUpperCase().replace(/[^A-Z]+/g, '_').replace(/_+$/, '') + ']'; }); });
  return { found, total: Object.values(found).reduce((a, b) => a + b, 0), redacted: red };
}
const COPYLEFT = /\b(A?GPL|LGPL|MPL|EUPL|CC-BY-SA|SSPL|OSL|CPAL)\b|general public|affero/i;
const RESTRICT = /\bNC\b|non-?commercial|openrail|llama|research only|cc-by-nc|gemma|^other$/i;
function licClass(l) { if (!l || /^(unknown|none|unlicensed)$/i.test(l.trim())) return 'Unknown'; if (COPYLEFT.test(l)) return 'Copyleft'; if (RESTRICT.test(l.trim())) return 'Review (custom / restricted)'; return 'Permissive'; }

/* Views */
const SECTIONS = [['dashboard', 'Overview'], ['registry', 'Model Registry'], ['bias', 'Bias Testing'], ['drift', 'Drift Telemetry'], ['policies', 'Policy Suite'], ['xai', 'XAI Matrix'], ['audit', 'Audit Trails'], ['privacy', 'Privacy Guard'], ['safety', 'Safety Bounds'], ['compliance', 'Compliance Map'], ['provenance', 'Model Provenance'], ['poisoning', 'Dataset Integrity']];
let current = 'dashboard';
function navRender() {
  let h = '<div class="nav-label">Workspace</div>';
  SECTIONS.forEach(([id, label]) => { if (id === 'provenance') h += '<div class="nav-label">Integrity &amp; supply</div>'; h += `<button class="nav-item ${id === current ? 'active' : ''}" data-id="${id}">${label}</button>`; });
  $('#nav').innerHTML = h; $('#nav').querySelectorAll('.nav-item').forEach(b => b.onclick = () => show(b.dataset.id));
}
function show(id) {
  if (!SECTIONS.some(s => s[0] === id)) id = 'dashboard';
  current = id; document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === id));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.id === id));
  $('#viewTitle').textContent = SECTIONS.find(s => s[0] === id)[1];
  if (location.hash !== '#' + id) history.replaceState(null, '', location.pathname + location.search + '#' + id);
  render(id); const c = $('.content'); if (c) c.scrollTop = 0; scrollTo(0, 0);
}
function render(id) { try { (VIEWS[id] || VIEWS.dashboard)(); } catch (e) { console.warn(e); $('#' + id).innerHTML = `<div class="card">Something went wrong drawing this page: ${esc(e.message)}</div>`; } headerRender(); }
function headerRender() { $('#orgPill').textContent = 'Org: ' + (S.org || 'set your org name'); }

const VIEWS = {};
VIEWS.dashboard = () => {
  const n = S.systems.length, el = $('#dashboard');
  if (!n && !S.tests.length && !S.policies.length && !S.incidents.length) {
    el.innerHTML = `<div class="card hero"><h3>Welcome to EthosGuard</h3><p class="big">A free workspace to govern the AI your organization uses: register systems, run real bias, drift, privacy and data-integrity tests on your own CSV files, check model and package licenses live, and track a NIST AI RMF checklist.</p>
    <p class="sub">Everything you enter stays in this browser on this device. Nothing is uploaded. Use <b>Export backup</b> to save or move it.</p>
    <div class="row" style="margin-top:14px"><button class="btn btn-primary big" data-go="registry" data-new="1">➕ Register your first AI system</button><button class="btn btn-ghost big" data-go="bias">Run a bias test</button><button class="btn btn-ghost big" data-ai="1">🛡️ Ask the AI for a risk check</button></div></div>
    <div class="grid g3" style="margin-top:16px">${['registry|Register|Inventory each AI system and get a rule-based EU AI Act / Colorado AI Act risk tier.', 'bias|Measure|Upload decisions as CSV to get selection rates, the four-fifths ratio and the equal-opportunity gap.', 'compliance|Prove|Tick off NIST AI RMF items. EthosGuard points to the evidence you already have.'].map(x => { const [g, t, d] = x.split('|'); return `<div class="card click" data-go="${g}"><h3>${t}</h3><p>${d}</p></div>`; }).join('')}</div>`;
    return;
  }
  const A = S.systems.map(s => ({ s, a: assess(s), e: sysEvidence(s.id) }));
  const high = A.filter(x => x.a.risk === 'High').length, open = S.incidents.filter(i => i.status !== 'Closed').length;
  const fails = A.filter(x => testStatus(x.e.bias) === 'Fail' || testStatus(x.e.drift) === 'Significant').length;
  const untested = A.filter(x => x.a.risk === 'High' && !x.e.bias).length;
  const np = nistPct();
  el.innerHTML = `<div class="grid g4" style="margin-bottom:16px">
    <div class="card"><h3>Registered systems</h3><div class="metric">${n}</div><div class="sub">${high} high risk</div></div>
    <div class="card"><h3>Open incidents</h3><div class="metric">${open}</div><div class="sub">${S.incidents.length} logged in total</div></div>
    <div class="card"><h3>Failing tests</h3><div class="metric">${fails}</div><div class="sub">${untested} high-risk systems never bias-tested</div></div>
    <div class="card"><h3>NIST AI RMF checklist</h3><div class="metric">${np}%</div>${meter(np, np >= 80 ? 'var(--ok)' : 'var(--warn)')}<div class="sub">self-assessment, not a certification</div></div></div>
  <div class="grid g2"><div class="card"><div class="row sb"><h3>Your AI systems</h3><button class="btn btn-ghost" data-go="registry" data-new="1">➕ Add</button></div>
    ${n ? `<div class="tw"><table><thead><tr><th>System</th><th>Risk</th><th>Bias</th><th>Drift</th><th>Next review</th></tr></thead><tbody>${A.map(x => `<tr class="click" data-sys="${x.s.id}"><td><b>${esc(x.s.name)}</b></td><td>${badge(x.a.risk)}</td><td>${x.e.bias ? badge(testStatus(x.e.bias)) : '<span class="sub">not tested</span>'}</td><td>${x.e.drift ? badge(testStatus(x.e.drift)) : '<span class="sub">—</span>'}</td><td>${esc(x.s.nextReview || '—')}${x.s.nextReview && x.s.nextReview < today() ? ' ' + badge('overdue') : ''}</td></tr>`).join('')}</tbody></table></div>` : empty('No systems registered yet.')}</div>
    <div class="card"><h3>What needs attention</h3><div class="stack">${attention(A).map(t => `<div class="rec">${t}</div>`).join('') || '<p class="sub">Nothing urgent. Keep testing on schedule.</p>'}</div></div></div>`;
};
function attention(A) {
  const out = [];
  A.forEach(({ s, a, e }) => {
    if (a.tier === 'Prohibited') out.push(`<b>${esc(s.name)}</b> matches a use the EU AI Act bans (${esc(a.why.join(', '))}). Stop and get legal advice before using it in the EU.`);
    if (a.risk === 'High' && !e.bias) out.push(`<b>${esc(s.name)}</b> is high risk and has no bias test. <a href="#bias">Run one</a>.`);
    if (testStatus(e.bias) === 'Fail') out.push(`<b>${esc(s.name)}</b> failed its last bias test (four-fifths ratio ${fmt(e.bias.result.di, 2)}).`);
    if (testStatus(e.drift) === 'Significant') out.push(`<b>${esc(s.name)}</b> shows significant data drift (PSI ${fmt(e.drift.result.max, 2)}). Review before relying on it.`);
    if (a.colorado && (!s.notice || !s.appeal)) out.push(`<b>${esc(s.name)}</b> makes consequential decisions: Colorado's AI Act expects notice to consumers, a way to appeal, and an impact assessment.`);
    if (s.nextReview && s.nextReview < today()) out.push(`<b>${esc(s.name)}</b> review is overdue (${esc(s.nextReview)}).`);
  });
  S.incidents.filter(i => i.status !== 'Closed' && i.severity === 'High').forEach(i => out.push(`High-severity incident open: <b>${esc(i.title)}</b>.`));
  return out.slice(0, 12);
}

VIEWS.registry = () => {
  $('#registry').innerHTML = `<div class="card"><div class="row sb"><h3>AI system registry</h3><button class="btn btn-primary big" id="newSys">➕ Register system</button></div>
  ${S.systems.length ? `<div class="tw"><table><thead><tr><th>System</th><th>Purpose</th><th>Owner</th><th>Risk</th><th>EU AI Act</th><th>Status</th><th>Next review</th></tr></thead><tbody>${S.systems.map(s => { const a = assess(s); return `<tr class="click" data-sys="${s.id}"><td><b>${esc(s.name)}</b></td><td class="muted">${esc(s.purpose)}</td><td>${esc(s.owner)}</td><td>${badge(a.risk)}</td><td>${badge(a.tier)}</td><td>${badge(s.status || 'Draft')}</td><td>${esc(s.nextReview || '—')}</td></tr>`; }).join('')}</tbody></table></div>` : empty('No AI systems yet. Register every AI tool or model your organization builds or buys — chatbots, scoring models, hiring tools, copilots.')}
  <p class="footer-note">Risk tiers are a rule-based first pass using EU AI Act Annex III / Article 5 categories and Colorado SB24-205 "consequential decision" areas. They are guidance, not legal advice.</p></div>`;
  $('#newSys').onclick = () => sysForm();
};
function sysForm(id) {
  const s = S.systems.find(x => x.id === id) || { id: '', name: '', purpose: '', owner: '', vendor: '', model: '', data: '', users: '', domains: [], decides: false, oversight: '', notice: false, appeal: false, status: 'Draft', nextReview: new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10), notes: '' };
  modal(`<div class="row sb"><h3>${id ? 'Edit' : 'Register'} AI system</h3><button class="btn btn-ghost" data-close>Close</button></div>
  <form id="sysF" class="form">
   <label>Name *<input name="name" required maxlength="120" value="${esc(s.name)}" placeholder="e.g. Resume screener"></label>
   <label>What does it do? *<textarea name="purpose" required rows="2" maxlength="1000" placeholder="e.g. Ranks job applicants for recruiters">${esc(s.purpose)}</textarea></label>
   <div class="g2 grid"><label>Owner (person or team)<input name="owner" maxlength="120" value="${esc(s.owner)}"></label><label>Vendor / built in-house<input name="vendor" maxlength="120" value="${esc(s.vendor)}"></label></div>
   <div class="g2 grid"><label>Model (Hugging Face id or product)<input name="model" maxlength="160" value="${esc(s.model)}" placeholder="e.g. distilbert/distilbert-base-uncased"></label><label>People affected<input name="users" maxlength="200" value="${esc(s.users)}" placeholder="e.g. Job applicants in the US"></label></div>
   <label>Data it uses<input name="data" maxlength="400" value="${esc(s.data)}" placeholder="e.g. resumes, job descriptions"></label>
   <fieldset><legend>Where is it used? (tick all that apply)</legend><div class="checks">${DOMAINS.map(d => `<label class="chk"><input type="checkbox" name="dom" value="${d[0]}" ${s.domains.includes(d[0]) ? 'checked' : ''}> ${d[1]}</label>`).join('')}</div></fieldset>
   <label class="chk"><input type="checkbox" name="decides" ${s.decides ? 'checked' : ''}> It makes, or is a big factor in, a decision about a person</label>
   <label class="chk"><input type="checkbox" name="notice" ${s.notice ? 'checked' : ''}> People are told AI is used</label>
   <label class="chk"><input type="checkbox" name="appeal" ${s.appeal ? 'checked' : ''}> People can correct data and appeal to a human</label>
   <label>Human oversight<input name="oversight" maxlength="300" value="${esc(s.oversight)}" placeholder="e.g. Recruiter reviews every rejection"></label>
   <div class="g2 grid"><label>Status<select name="status">${['Draft', 'In review', 'Approved', 'Conditional', 'Retired'].map(x => `<option ${x === s.status ? 'selected' : ''}>${x}</option>`).join('')}</select></label><label>Next review<input type="date" name="nextReview" value="${esc(s.nextReview)}"></label></div>
   <label>Notes<textarea name="notes" rows="2" maxlength="3000">${esc(s.notes)}</textarea></label>
   <div class="row"><button class="btn btn-primary big" type="submit">Save system</button>${id ? '<button class="btn btn-ghost big danger" type="button" id="delSys">Delete</button>' : ''}</div></form>`);
  $('#sysF').onsubmit = e => {
    e.preventDefault(); const f = new FormData(e.target);
    const o = Object.assign(s, { name: f.get('name').trim(), purpose: f.get('purpose').trim(), owner: f.get('owner').trim(), vendor: f.get('vendor').trim(), model: f.get('model').trim(), users: f.get('users').trim(), data: f.get('data').trim(), domains: f.getAll('dom'), decides: !!f.get('decides'), notice: !!f.get('notice'), appeal: !!f.get('appeal'), oversight: f.get('oversight').trim(), status: f.get('status'), nextReview: f.get('nextReview'), notes: f.get('notes').trim() });
    if (!o.id) { o.id = uid(); o.created = today(); S.systems.push(o); log('Registered system', o.id); } else log('Updated system', o.id);
    save(); render(current); openSystem(o.id);
  };
  const d = $('#delSys'); if (d) d.onclick = () => { if (!confirm('Delete this system? Its tests stay in the audit trail.')) return; S.systems = S.systems.filter(x => x.id !== id); log('Deleted system "' + s.name + '"'); save(); closeModal(); render(current); };
}
function openSystem(id) {
  const s = S.systems.find(x => x.id === id); if (!s) return; const a = assess(s), e = sysEvidence(id);
  modal(`<div class="row sb"><h3>${esc(s.name)}</h3><div class="row"><button class="btn btn-ghost" data-edit="${id}">Edit</button><button class="btn btn-ghost" data-close>Close</button></div></div>
  <div class="stack" style="margin-top:8px">
   ${kv('Purpose', esc(s.purpose))}${kv('Owner', esc(s.owner || '—'))}${kv('Vendor / model', esc([s.vendor, s.model].filter(Boolean).join(' · ') || '—'))}
   ${kv('People affected', esc(s.users || '—'))}${kv('Data used', esc(s.data || '—'))}
   ${kv('Risk', badge(a.risk) + ' ' + badge('EU AI Act: ' + a.tier) + (a.colorado ? ' ' + badge('Colorado AI Act: high-risk likely') : ''))}
   ${kv('Why', esc(a.why.join('; ') || 'No regulated use ticked'))}
   ${kv('Oversight', esc(s.oversight || '—'))}${kv('Notice / appeal', (s.notice ? '✅ notice' : '❌ no notice') + ' · ' + (s.appeal ? '✅ appeal' : '❌ no appeal'))}
   ${kv('Status', badge(s.status || 'Draft'))}${kv('Next review', esc(s.nextReview || '—'))}
   ${kv('Evidence', ['bias', 'drift', 'integrity', 'privacy'].map(k => e[k] ? `${k}: ${badge(testStatus(e[k]))} <span class="sub">${e[k].at.slice(0, 10)}</span>` : `${k}: <span class="sub">none</span>`).join('<br>') + (e.model ? `<br>model: ${esc(e.model.id)} ${badge(licClass(e.model.license))}` : ''))}
   <h3 style="margin-top:10px">AI recommendations</h3><div id="recs">${s.recs ? recsHtml(s.recs.items) : ''}<button class="btn btn-primary big" id="getRecs">✨ ${s.recs ? 'Refresh' : 'Get free'} AI recommendations</button></div>
  </div>`);
  $('#getRecs').onclick = () => aiRecs(s);
}
const recsHtml = r => r.map(x => `<div class="rec"><b>${esc(x.area || '')}</b> — ${esc(x.action || '')}<div class="sub">${esc(x.why || '')}</div></div>`).join('') + '<p class="footer-note">Free AI guidance, not legal advice. Check before acting.</p>';
async function aiRecs(s) {
  const box = $('#recs'); box.innerHTML = '<p class="sub">Thinking… (free AI, can take 10–40 seconds)</p>';
  const a = assess(s), e = sysEvidence(s.id);
  const facts = { name: s.name, purpose: s.purpose, data: s.data, people: s.users, uses: a.why, eu_tier: a.tier, colorado_consequential: a.colorado, oversight: s.oversight, notice: s.notice, appeal: s.appeal, bias: e.bias ? { four_fifths_ratio: e.bias.result.di, eo_gap: e.bias.result.eo } : 'not tested', drift_max_psi: e.drift ? e.drift.result.max : 'not tested', integrity_issues: e.integrity ? e.integrity.result.list : 'not tested', license: e.model ? e.model.license : 'not checked' };
  try {
    const t = await AIHelper.ask('You are a practical responsible-AI governance reviewer. Using ONLY the facts given, return JSON {"recommendations":[{"area":"bias|privacy|transparency|oversight|governance|security|legal","action":"one concrete sentence","why":"short reason"}]} with 4-6 items, most urgent first. Do not invent test results. Guidance only, not legal advice.', JSON.stringify(facts), { json: true, raw: true });
    const j = typeof t === 'string' ? AIHelper.parseJSON(t) : t; const r = (j && (j.recommendations || (Array.isArray(j) ? j : null))) || [];
    if (!r.length) throw new Error('empty');
    s.recs = { at: new Date().toISOString(), items: r.slice(0, 8) }; log('AI recommendations generated', s.id); save();
    if ($('#recs')) $('#recs').innerHTML = recsHtml(s.recs.items);
  } catch (err) { console.warn(err); if (!$('#recs')) return; $('#recs').innerHTML = '<p>The free AI is busy right now. <button class="btn btn-ghost" id="getRecs">Try again</button></p>'; $('#getRecs').onclick = () => aiRecs(s); }
}

VIEWS.bias = () => {
  const el = $('#bias'), D = loaded.bias;
  el.innerHTML = `<div class="card"><h3>Bias test (on your device)</h3><p>Upload a CSV with one row per decision: a group column (e.g. sex, race, age band), the AI's decision, and optionally the true outcome.</p>
   <div class="row" style="margin:10px 0">${fileBox('biasFile', D ? 'Change CSV' : 'Choose CSV file')}<span class="sub">${D ? esc(D.name) + ' · ' + D.rows.length + ' rows' : 'Your file never leaves this device.'}</span></div>
   <div id="biasCfg"></div></div><div id="biasOut"></div>${historyCard('bias')}`;
  $('#biasFile').onchange = ev => loadCSV(ev, 'bias');
  if (!D) return;
  const g = guess(D, /sex|gender|race|ethnic|age|group|protected/i), p = guess(D, /pred|decision|approved|hired|selected|score|outcome/i);
  $('#biasCfg').innerHTML = `<div class="grid g2 form"><label>Group column${colSelect('bg', D, g)}</label><label>Decision column${colSelect('bp', D, p)}</label><label>Positive decision value<select id="bpos"></select></label><label>True outcome column (optional)${colSelect('by', D, -1, '— none —')}</label><label>Positive outcome value<select id="bypos"></select></label><label>Link to system<select id="bsys">${sysOptions('', true)}</select></label></div><button class="btn btn-primary big" id="runBias">▶ Run bias test</button>`;
  const fillVals = (src, dst) => { const c = $(src).value; $(dst).innerHTML = c === '' ? '' : uniques(D, +c, 30).map(([v, n]) => `<option value="${esc(v)}">${esc(v || '(blank)')} (${n})</option>`).join(''); };
  $('#bp').onchange = () => fillVals('#bp', '#bpos'); $('#by').onchange = () => fillVals('#by', '#bypos'); fillVals('#bp', '#bpos');
  $('#runBias').onclick = () => {
    const y = $('#by').value === '' ? null : +$('#by').value;
    const r = biasTest(D, +$('#bg').value, +$('#bp').value, $('#bpos').value, y, y == null ? null : $('#bypos').value);
    const t = { id: uid(), kind: 'bias', at: new Date().toISOString(), system: $('#bsys').value, file: D.name, cfg: { group: D.head[$('#bg').value], decision: D.head[$('#bp').value], positive: $('#bpos').value, outcome: y == null ? '' : D.head[y] }, result: r };
    S.tests.unshift(t); log(`Bias test on ${D.name}: four-fifths ratio ${fmt(r.di, 2)}`, t.system); save(); showBias(t); renderHistory('bias');
  };
};
function showBias(t) {
  const r = t.result, st = testStatus(t);
  $('#biasOut').innerHTML = `<div class="card" style="margin-top:16px"><div class="row sb"><h3>Result · ${esc(t.cfg.group)} → ${esc(t.cfg.decision)} = "${esc(t.cfg.positive)}"</h3>${badge(st)}</div>
  <div class="grid g3"><div><div class="metric" id="biasDI">${fmt(r.di, 2)}</div><div class="sub">Four-fifths ratio (lowest ÷ highest selection rate). Pass bar ≥ ${S.bounds.di}</div></div>
  <div><div class="metric">${fmt(r.dpd, 3)}</div><div class="sub">Demographic parity gap (highest − lowest rate)</div></div>
  <div><div class="metric">${fmt(r.eo, 3)}</div><div class="sub">Equal-opportunity gap (true positive rate spread)${r.eo == null ? ' — add a true outcome column' : '. Bar ≤ ' + S.bounds.eo}</div></div></div>
  <div class="tw"><table style="margin-top:12px"><thead><tr><th>Group</th><th>Rows</th><th>Selection rate</th><th>True positive rate</th><th>False positive rate</th></tr></thead><tbody>${r.groups.map(x => `<tr><td>${esc(x.group)}</td><td>${x.n}</td><td>${fmt(x.rate * 100, 1)}%<div class="meter"><span style="width:${x.rate * 100}%;background:var(--accent)"></span></div></td><td>${x.tpr == null ? '—' : fmt(x.tpr * 100, 1) + '%'}</td><td>${x.fpr == null ? '—' : fmt(x.fpr * 100, 1) + '%'}</td></tr>`).join('')}</tbody></table></div>
  ${r.small.length ? `<p class="footer-note">Groups with fewer than 20 rows were left out of the ratio: ${esc(r.small.join(', '))}. Small groups give unreliable rates.</p>` : ''}
  <div class="row" style="margin-top:12px"><button class="btn btn-ghost" data-explain="${t.id}">✨ Explain with free AI</button></div></div>`;
}
function historyCard(kind) { return `<div class="card" style="margin-top:16px"><h3>Saved ${kind} tests</h3><div id="hist-${kind}">${histRows(kind)}</div></div>`; }
function histRows(kind) { const t = S.tests.filter(x => x.kind === kind); return t.length ? `<div class="tw"><table><thead><tr><th>When</th><th>File</th><th>System</th><th>Result</th><th></th></tr></thead><tbody>${t.map(x => `<tr><td>${new Date(x.at).toLocaleString()}</td><td>${esc(x.file)}</td><td>${esc(sysName(x.system) || '—')}</td><td>${badge(testStatus(x))}</td><td><button class="btn btn-ghost" data-deltest="${x.id}">Delete</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="sub">No tests saved yet.</p>'; }
function renderHistory(kind) { const el = $('#hist-' + kind); if (el) el.innerHTML = histRows(kind); }
async function loadCSV(ev, slot) {
  const f = ev.target.files[0]; if (!f) return;
  if (f.size > 25e6) return toast('That file is over 25 MB. Use a sample of the rows.');
  try { const D = parseCSV(await readFile(f)); D.name = f.name; loaded[slot] = D; if (D.truncated) toast('Only the first 50,000 rows were loaded.'); render(current); } catch (e) { toast('Could not read that CSV: ' + e.message); }
}

VIEWS.drift = () => {
  const el = $('#drift'), B = loaded.driftBase, C = loaded.driftCur;
  el.innerHTML = `<div class="card"><h3>Data drift (Population Stability Index)</h3><p>Compare the data your model was built on (baseline) with what it sees now. Same column names in both files.</p>
  <div class="grid g2" style="margin:10px 0"><div>${fileBox('dB', B ? 'Change baseline' : 'Baseline CSV')}<div class="sub">${B ? esc(B.name) + ' · ' + B.rows.length + ' rows' : ''}</div></div><div>${fileBox('dC', C ? 'Change current' : 'Current CSV')}<div class="sub">${C ? esc(C.name) + ' · ' + C.rows.length + ' rows' : ''}</div></div></div>
  ${B && C ? `<div class="form"><label>Link to system<select id="dsys">${sysOptions('', true)}</select></label></div><button class="btn btn-primary big" id="runDrift">▶ Measure drift</button>` : ''}
  <p class="footer-note">PSI under 0.10 = stable, 0.10–0.25 = moderate shift, over 0.25 = significant shift (your bound: ${S.bounds.psi}).</p></div><div id="driftOut"></div>${historyCard('drift')}`;
  $('#dB').onchange = ev => loadCSV(ev, 'driftBase'); $('#dC').onchange = ev => loadCSV(ev, 'driftCur');
  const run = $('#runDrift'); if (run) run.onclick = () => {
    const cols = B.head.filter(h => C.head.includes(h)); if (!cols.length) return toast('The two files share no column names.');
    const res = cols.map(h => { const bi = B.head.indexOf(h), ci = C.head.indexOf(h); const num = colIsNum(B, bi) && colIsNum(C, ci); const v = psi(B.rows.map(r => (r[bi] || '').trim()), C.rows.map(r => (r[ci] || '').trim()), num); return { col: h, type: num ? 'number' : 'category', psi: v }; }).filter(x => x.psi != null).sort((a, b) => b.psi - a.psi);
    if (!res.length) return toast('Not enough rows to compare (need at least 10 per file).');
    const t = { id: uid(), kind: 'drift', at: new Date().toISOString(), system: $('#dsys').value, file: B.name + ' → ' + C.name, result: { cols: res, max: res[0].psi } };
    S.tests.unshift(t); log(`Drift test ${t.file}: max PSI ${fmt(t.result.max, 2)}`, t.system); save(); showDrift(t); renderHistory('drift');
  };
};
function showDrift(t) { const cls = v => v < 0.1 ? 'Stable' : v <= S.bounds.psi ? 'Moderate' : 'Significant'; $('#driftOut').innerHTML = `<div class="card" style="margin-top:16px"><div class="row sb"><h3>Drift by column</h3>${badge(testStatus(t))}</div><div class="tw"><table><thead><tr><th>Column</th><th>Type</th><th>PSI</th><th>Shift</th></tr></thead><tbody>${t.result.cols.map(c => `<tr><td>${esc(c.col)}</td><td>${c.type}</td><td>${fmt(c.psi, 3)}<div class="meter"><span style="width:${Math.min(100, c.psi * 200)}%;background:${c.psi > S.bounds.psi ? 'var(--bad)' : c.psi >= 0.1 ? 'var(--warn)' : 'var(--ok)'}"></span></div></td><td>${badge(cls(c.psi))}</td></tr>`).join('')}</tbody></table></div><div class="row" style="margin-top:12px"><button class="btn btn-ghost" data-explain="${t.id}">✨ Explain with free AI</button></div></div>`; }

VIEWS.policies = () => {
  $('#policies').innerHTML = `<div class="grid g2"><div class="card"><div class="row sb"><h3>Your policy library</h3><button class="btn btn-primary" id="newPol">➕ Blank policy</button></div>
   ${S.policies.length ? `<div class="tw"><table><thead><tr><th>Policy</th><th>Audience</th><th>Status</th><th>Updated</th></tr></thead><tbody>${S.policies.map(p => `<tr class="click" data-pol="${p.id}"><td><b>${esc(p.title)}</b></td><td class="muted">${esc(p.audience)}</td><td>${badge(p.status)}</td><td>${esc(p.updated)}</td></tr>`).join('')}</tbody></table></div>` : empty('No policies yet. Adopt a starter template, then edit it to fit your organization.')}</div>
   <div class="card"><h3>Starter templates</h3><div class="stack">${TEMPLATES.map((t, i) => `<div class="check-row"><div class="check-label"><b>${esc(t[0])}</b><span class="sub">${esc(t[1])}</span></div><button class="btn btn-ghost" data-adopt="${i}">Adopt</button></div>`).join('')}</div>
   <h3 style="margin-top:16px">Write one with free AI</h3><div class="form"><input id="polTopic" placeholder="e.g. Use of AI note-takers in meetings" maxlength="200"></div><button class="btn btn-primary" id="aiPol" style="margin-top:8px">✨ Draft policy</button><p class="footer-note">Templates and AI drafts are starting points, not legal advice. Have them reviewed.</p></div></div>`;
  $('#newPol').onclick = () => polForm({ id: '', title: '', audience: '', status: 'Draft', text: '' });
  $('#aiPol').onclick = async () => {
    const topic = $('#polTopic').value.trim(); if (!topic) return toast('Type what the policy should cover.');
    const b = $('#aiPol'); b.disabled = true; b.textContent = 'Drafting… (10–40 s)';
    try { const t = await AIHelper.ask('You write short, plain-English internal AI governance policies. Output plain text: a Purpose line, then 5-8 numbered rules, then who owns it. No markdown. Not legal advice.', `Organization: ${S.org || 'our organization'}. Policy topic: ${topic}. AI systems we use: ${S.systems.map(s => s.name + ' (' + s.purpose + ')').join('; ') || 'not listed yet'}.`); polForm({ id: '', title: topic.slice(0, 100), audience: 'All staff', status: 'Draft', text: String(t).replace(/\*\*/g, '').replace(/^#+\s*/gm, '') }); }
    catch (e) { console.warn(e); toast('The free AI is busy. Try again in a minute.'); }
    b.disabled = false; b.textContent = '✨ Draft policy';
  };
};
function polForm(p) {
  modal(`<div class="row sb"><h3>${p.id ? 'Edit policy' : 'New policy'}</h3><button class="btn btn-ghost" data-close>Close</button></div><form id="polF" class="form"><label>Title<input name="title" required maxlength="120" value="${esc(p.title)}"></label><div class="grid g2"><label>Audience<input name="audience" maxlength="120" value="${esc(p.audience)}"></label><label>Status<select name="status">${['Draft', 'Active', 'Retired'].map(x => `<option ${x === p.status ? 'selected' : ''}>${x}</option>`).join('')}</select></label></div><label>Text<textarea name="text" rows="14" maxlength="20000">${esc(p.text)}</textarea></label><div class="row"><button class="btn btn-primary big" type="submit">Save</button>${p.id ? `<button type="button" class="btn btn-ghost big" id="dlPol">Download</button><button type="button" class="btn btn-ghost big danger" id="delPol">Delete</button>` : ''}</div></form>`);
  $('#polF').onsubmit = e => { e.preventDefault(); const f = new FormData(e.target); Object.assign(p, { title: f.get('title').trim(), audience: f.get('audience').trim(), status: f.get('status'), text: f.get('text'), updated: today() }); if (!p.id) { p.id = uid(); S.policies.push(p); log('Policy created: ' + p.title); } else log('Policy updated: ' + p.title + ' (' + p.status + ')'); save(); closeModal(); render('policies'); };
  if (p.id) { $('#dlPol').onclick = () => download(p.title.replace(/[^\w-]+/g, '_') + '.txt', p.title + '\nAudience: ' + p.audience + '\nStatus: ' + p.status + '\nUpdated: ' + p.updated + '\n\n' + p.text); $('#delPol').onclick = () => { if (!confirm('Delete this policy?')) return; S.policies = S.policies.filter(x => x !== p); log('Policy deleted: ' + p.title); save(); closeModal(); render('policies'); }; }
}

const XCOLS = [['global', 'How it works overall (model card / docs)'], ['local', 'Reason for each decision'], ['counter', 'What would change the outcome'], ['notice', 'Plain-language notice'], ['logs', 'Decision logs kept']];
VIEWS.xai = () => {
  const D = loaded.xai;
  $('#xai').innerHTML = `<div class="card"><h3>Explanation coverage</h3>${S.systems.length ? `<div class="tw"><table><thead><tr><th>System</th>${XCOLS.map(c => `<th>${esc(c[1])}</th>`).join('')}</tr></thead><tbody>${S.systems.map(s => `<tr><td><b>${esc(s.name)}</b></td>${XCOLS.map(c => `<td><input type="checkbox" class="big-check" data-x="${s.id}|${c[0]}" ${(S.xai[s.id] || {})[c[0]] ? 'checked' : ''} aria-label="${esc(s.name + ' ' + c[1])}"></td>`).join('')}</tr>`).join('')}</tbody></table></div>` : empty('Register a system first, then tick which explanations auditors and affected people can get.')}</div>
  <div class="card" style="margin-top:16px"><h3>Feature influence (on your device)</h3><p>Upload a CSV with your model's inputs and its output. EthosGuard ranks which columns move the output most (correlation for numbers, rate spread for categories) and flags columns that may be proxies for protected traits.</p>
  <div class="row" style="margin:10px 0">${fileBox('xFile', D ? 'Change CSV' : 'Choose CSV')}<span class="sub">${D ? esc(D.name) + ' · ' + D.rows.length + ' rows' : ''}</span></div>
  ${D ? `<div class="grid g2 form"><label>Output column${colSelect('xo', D, guess(D, /pred|score|decision|approved|outcome|label|target/i))}</label><label>Link to system<select id="xsys">${sysOptions('', true)}</select></label></div><button class="btn btn-primary big" id="runX">▶ Rank features</button><div id="xOut"></div>` : ''}</div>`;
  $('#xFile').onchange = ev => loadCSV(ev, 'xai');
  document.querySelectorAll('[data-x]').forEach(cb => cb.onchange = () => { const [id, k] = cb.dataset.x.split('|'); S.xai[id] = S.xai[id] || {}; S.xai[id][k] = cb.checked; log(`Explainability: ${k} ${cb.checked ? 'available' : 'removed'}`, id); save(); });
  const r = $('#runX'); if (r) r.onclick = () => {
    const o = +$('#xo').value; let ys = D.rows.map(x => (x[o] || '').trim());
    if (!colIsNum(D, o)) { const top = uniques(D, o, 50)[0][0]; ys = ys.map(v => v === top ? 1 : 0); } else ys = ys.map(v => isNum(v) ? +v : NaN);
    const res = D.head.map((h, i) => {
      if (i === o) return null; const xs = D.rows.map(x => (x[i] || '').trim());
      if (colIsNum(D, i)) { const pairs = xs.map((v, k) => [v, ys[k]]).filter(([v, y]) => isNum(v) && isFinite(y)).map(([v, y]) => [+v, y]); if (pairs.length < 10) return null; const n = pairs.length, mx = pairs.reduce((a, p) => a + p[0], 0) / n, my = pairs.reduce((a, p) => a + p[1], 0) / n; let sxy = 0, sx = 0, sy = 0; pairs.forEach(([x, y]) => { sxy += (x - mx) * (y - my); sx += (x - mx) ** 2; sy += (y - my) ** 2; }); const c = sx && sy ? sxy / Math.sqrt(sx * sy) : 0; return { col: h, how: 'correlation', v: c, s: Math.abs(c) }; }
      const g = new Map(); xs.forEach((v, k) => { if (!isFinite(ys[k])) return; const a = g.get(v) || [0, 0]; a[0] += ys[k]; a[1]++; g.set(v, a); }); if (g.size < 2 || g.size > 100) return null; const m = [...g.values()].filter(a => a[1] >= 5).map(a => a[0] / a[1]); if (m.length < 2) return null; const sp = Math.max(...m) - Math.min(...m); return { col: h, how: 'rate spread', v: sp, s: sp };
    }).filter(Boolean).sort((a, b) => b.s - a.s);
    if (!res.length) return toast('Not enough usable columns or rows to rank.');
    const proxy = /zip|postal|name|age|sex|gender|race|ethnic|religion|marital|nation|language|disab|pregnan/i;
    const t = { id: uid(), kind: 'influence', at: new Date().toISOString(), system: $('#xsys').value, file: D.name, result: { cols: res.slice(0, 40) } }; S.tests.unshift(t); log('Feature influence ranked on ' + D.name, t.system); save();
    $('#xOut').innerHTML = `<div class="tw"><table style="margin-top:12px"><thead><tr><th>Column</th><th>Method</th><th>Strength</th><th></th></tr></thead><tbody>${res.slice(0, 40).map(x => `<tr><td>${esc(x.col)}</td><td>${x.how}</td><td>${fmt(x.v, 3)}<div class="meter"><span style="width:${Math.min(100, x.s * 100)}%;background:var(--accent)"></span></div></td><td>${proxy.test(x.col) ? '<span class="flag-tag bad">protected / proxy?</span>' : ''}</td></tr>`).join('')}</tbody></table></div><p class="footer-note">This shows association, not cause. A strong column that is, or stands in for, a protected trait needs review.</p>`;
  };
};

VIEWS.audit = () => {
  $('#audit').innerHTML = `<div class="card"><div class="row sb"><h3>Audit trail</h3><div class="row"><button class="btn btn-ghost" id="addNote">➕ Add note</button><button class="btn btn-ghost" id="audCsv" ${S.audit.length ? '' : 'disabled'}>⬇ Export CSV</button></div></div>
  ${S.audit.length ? `<div class="tw"><table><thead><tr><th>When</th><th>System</th><th>Event</th><th>By</th></tr></thead><tbody>${S.audit.slice(0, 500).map(a => `<tr><td class="muted">${new Date(a.at).toLocaleString()}</td><td>${esc(sysName(a.system) || '—')}</td><td>${esc(a.event)}</td><td>${esc(a.actor)}</td></tr>`).join('')}</tbody></table></div>` : empty('Nothing logged yet. Every system change, test and incident you record is logged here automatically.')}</div>`;
  $('#addNote').onclick = () => { const t = prompt('Audit note (e.g. "Legal approved launch of Resume screener")'); if (t && t.trim()) { log(t.trim().slice(0, 500)); render('audit'); } };
  $('#audCsv').onclick = () => download('ethosguard-audit-' + today() + '.csv', 'when,system,event,by\n' + S.audit.map(a => [a.at, sysName(a.system), a.event, a.actor].map(csvCell).join(',')).join('\n'), 'text/csv');
};

VIEWS.privacy = () => {
  $('#privacy').innerHTML = `<div class="card"><h3>Personal data scanner (on your device)</h3><p>Paste text (prompts, chat logs, training data) or load a file. EthosGuard finds emails, phone numbers, SSNs, card numbers (checked with the Luhn test), IP addresses, street addresses and dates, and makes a redacted copy.</p>
  <div class="form"><textarea id="pText" rows="8" placeholder="Paste text here…"></textarea></div>
  <div class="row" style="margin-top:10px"><label class="file"><input type="file" id="pFile" accept=".csv,.txt,.json,.log,text/*"><span>📄 Or load a file</span></label><select id="psys" aria-label="Link to system">${sysOptions('', true)}</select><button class="btn btn-primary big" id="runP">🔍 Scan</button></div><div id="pOut"></div>
  <p class="footer-note">Pattern matching finds common formats; it can miss names and unusual formats and can flag look-alike numbers. Review before sharing data.</p></div>${historyCard('privacy')}`;
  let fname = 'pasted text';
  $('#pFile').onchange = async ev => { const f = ev.target.files[0]; if (!f) return; if (f.size > 10e6) return toast('Over 10 MB — use a smaller sample.'); $('#pText').value = await readFile(f); fname = f.name; };
  $('#runP').onclick = () => {
    const txt = $('#pText').value; if (!txt.trim()) return toast('Paste some text or load a file first.');
    const r = piiScan(txt); const t = { id: uid(), kind: 'privacy', at: new Date().toISOString(), system: $('#psys').value, file: fname, result: { found: r.found, total: r.total } };
    S.tests.unshift(t); log(`Privacy scan of ${fname}: ${r.total} items found`, t.system); save(); renderHistory('privacy');
    $('#pOut').innerHTML = `<div style="margin-top:14px"><div class="row">${r.total ? Object.entries(r.found).map(([k, n]) => `<span class="flag-tag bad">${esc(k)}: ${n}</span>`).join('') : '<span class="flag-tag ok">No common personal data patterns found</span>'}</div>
     ${r.total ? `<h3 style="margin-top:12px">Redacted copy</h3><div class="form"><textarea id="pRed" rows="8" readonly>${esc(r.redacted.slice(0, 200000))}</textarea></div><button class="btn btn-ghost" id="dlRed" style="margin-top:8px">⬇ Download redacted</button>` : ''}</div>`;
    const d = $('#dlRed'); if (d) d.onclick = () => download('redacted-' + fname.replace(/[^\w.-]+/g, '_') + (/\.\w+$/.test(fname) ? '' : '.txt'), r.redacted);
  };
};

VIEWS.safety = () => {
  const br = []; S.systems.forEach(s => { const e = sysEvidence(s.id); if (testStatus(e.bias) === 'Fail') br.push(`${esc(s.name)}: four-fifths ratio ${fmt(e.bias.result.di, 2)} (bound ${S.bounds.di})${e.bias.result.eo != null && e.bias.result.eo > S.bounds.eo ? `, equal-opportunity gap ${fmt(e.bias.result.eo, 2)} above ${S.bounds.eo}` : ''}`); if (e.drift && e.drift.result.max > S.bounds.psi) br.push(`${esc(s.name)}: drift PSI ${fmt(e.drift.result.max, 2)} above ${S.bounds.psi}`); if (assess(s).risk === 'High' && !s.oversight) br.push(`${esc(s.name)}: high risk with no human oversight recorded`); });
  $('#safety').innerHTML = `<div class="grid g2"><div class="card"><h3>Your safety bounds</h3><form id="bF" class="form">
   <label>Minimum four-fifths ratio <input type="number" step="0.01" min="0" max="1" name="di" value="${S.bounds.di}"></label>
   <label>Maximum equal-opportunity gap <input type="number" step="0.01" min="0" max="1" name="eo" value="${S.bounds.eo}"></label>
   <label>Maximum drift (PSI) <input type="number" step="0.01" min="0" max="5" name="psi" value="${S.bounds.psi}"></label>
   <button class="btn btn-primary">Save bounds</button></form></div>
   <div class="card"><h3>Bound breaches (from your saved tests)</h3>${br.length ? br.map(b => `<div class="rec" style="margin-bottom:8px">${b}</div>`).join('') : '<p class="sub">No breaches. Breaches show here once tests are linked to systems.</p>'}</div></div>
   <div class="card" style="margin-top:16px"><div class="row sb"><h3>AI incident register</h3><button class="btn btn-primary big" id="newInc">➕ Log incident</button></div>
   ${S.incidents.length ? `<div class="tw"><table><thead><tr><th>Date</th><th>Incident</th><th>System</th><th>Severity</th><th>Status</th></tr></thead><tbody>${S.incidents.map(i => `<tr class="click" data-inc="${i.id}"><td>${esc(i.date)}</td><td><b>${esc(i.title)}</b></td><td>${esc(sysName(i.system) || '—')}</td><td>${badge(i.severity)}</td><td>${badge(i.status)}</td></tr>`).join('')}</tbody></table></div>` : empty('No incidents logged. Log any time an AI system gives harmful, wrong, biased or leaked output — or nearly does.')}</div>`;
  $('#bF').onsubmit = e => { e.preventDefault(); const f = new FormData(e.target); S.bounds = { di: +f.get('di'), eo: +f.get('eo'), psi: +f.get('psi') }; log(`Safety bounds set: ratio ≥ ${S.bounds.di}, EO gap ≤ ${S.bounds.eo}, PSI ≤ ${S.bounds.psi}`); save(); render('safety'); toast('Bounds saved'); };
  $('#newInc').onclick = () => incForm({ id: '', title: '', system: '', severity: 'Medium', status: 'Open', date: today(), what: '', action: '' });
};
function incForm(i) {
  modal(`<div class="row sb"><h3>${i.id ? 'Incident' : 'Log incident'}</h3><button class="btn btn-ghost" data-close>Close</button></div><form id="incF" class="form"><label>Title<input name="title" required maxlength="160" value="${esc(i.title)}"></label><div class="grid g2"><label>System<select name="system">${sysOptions(i.system, true)}</select></label><label>Date<input type="date" name="date" value="${esc(i.date)}"></label><label>Severity<select name="severity">${['Low', 'Medium', 'High'].map(x => `<option ${x === i.severity ? 'selected' : ''}>${x}</option>`).join('')}</select></label><label>Status<select name="status">${['Open', 'Mitigating', 'Closed'].map(x => `<option ${x === i.status ? 'selected' : ''}>${x}</option>`).join('')}</select></label></div><label>What happened<textarea name="what" rows="4" maxlength="5000">${esc(i.what)}</textarea></label><label>Actions taken / root cause<textarea name="action" rows="3" maxlength="5000">${esc(i.action)}</textarea></label><div class="row"><button class="btn btn-primary big" type="submit">Save</button>${i.id ? '<button type="button" class="btn btn-ghost big danger" id="delInc">Delete</button>' : ''}</div></form>`);
  $('#incF').onsubmit = e => { e.preventDefault(); const f = new FormData(e.target); const was = i.status; Object.assign(i, Object.fromEntries(['title', 'system', 'date', 'severity', 'status', 'what', 'action'].map(k => [k, String(f.get(k) || '').trim()]))); if (!i.id) { i.id = uid(); S.incidents.unshift(i); log(`Incident logged (${i.severity}): ${i.title}`, i.system); } else log(`Incident ${i.title}: ${was} → ${i.status}`, i.system); save(); closeModal(); render('safety'); };
  const d = $('#delInc'); if (d) d.onclick = () => { if (!confirm('Delete this incident?')) return; S.incidents = S.incidents.filter(x => x !== i); log('Incident deleted: ' + i.title); save(); closeModal(); render('safety'); };
}

VIEWS.compliance = () => {
  const np = nistPct(), fns = ['GOVERN', 'MAP', 'MEASURE', 'MANAGE'];
  const tiers = S.systems.map(s => ({ s, a: assess(s) }));
  $('#compliance').innerHTML = `<div class="grid g2"><div class="card"><div class="row sb"><h3>NIST AI RMF 1.0 self-assessment</h3>${badge('Not a certification')}</div><div class="metric">${np}%</div>${meter(np, np >= 80 ? 'var(--ok)' : 'var(--warn)')}
   ${fns.map(fn => `<h3 style="margin-top:14px">${fn}</h3>${NIST.filter(n => n[0] === fn).map(n => { const auto = nistAuto(n[1]); return `<label class="check-row"><span class="check-label"><b>${n[1]}</b><span class="sub">${esc(n[2])}</span>${auto && !S.nist[n[1]] ? `<span class="sub" style="color:var(--ok)">Evidence found in your ${n[3]} — tick if it is enough.</span>` : ''}</span><input type="checkbox" class="big-check" data-n="${n[1]}" ${S.nist[n[1]] ? 'checked' : ''}></label>`; }).join('')}`).join('')}
   <p class="footer-note">Selected subcategories from NIST AI 100-1 (AI RMF 1.0), paraphrased. Full framework: <a href="https://www.nist.gov/itl/ai-risk-management-framework" target="_blank" rel="noopener">nist.gov</a>.</p></div>
   <div class="card"><h3>Law &amp; framework map for your systems</h3>${tiers.length ? `<div class="tw"><table><thead><tr><th>System</th><th>EU AI Act</th><th>Colorado AI Act</th><th>Gaps</th></tr></thead><tbody>${tiers.map(({ s, a }) => `<tr class="click" data-sys="${s.id}"><td><b>${esc(s.name)}</b></td><td>${badge(a.tier)}</td><td>${a.colorado ? badge('High-risk likely') : '<span class="sub">likely not</span>'}</td><td class="sub">${esc(gaps(s, a).join('; ') || '—')}</td></tr>`).join('')}</tbody></table></div>` : empty('Register systems to map them to the EU AI Act and Colorado AI Act.')}
   <h3 style="margin-top:16px">Export</h3><div class="stack"><button class="btn btn-ghost big" id="exReport">⬇ Governance report (HTML, printable to PDF)</button><button class="btn btn-ghost big" id="exNist">⬇ NIST checklist (CSV)</button><button class="btn btn-ghost big" id="exReg">⬇ System register (CSV)</button></div>
   <p class="footer-note">Rule-based mapping for planning. Not legal advice; laws change — confirm with counsel. EU AI Act: <a href="https://artificialintelligenceact.eu/" target="_blank" rel="noopener">overview</a>. Colorado SB24-205: <a href="https://leg.colorado.gov/bills/sb24-205" target="_blank" rel="noopener">bill page</a>.</p></div></div>`;
  document.querySelectorAll('[data-n]').forEach(cb => cb.onchange = () => { S.nist[cb.dataset.n] = cb.checked; log(`NIST ${cb.dataset.n} marked ${cb.checked ? 'done' : 'not done'}`); save(); render('compliance'); });
  $('#exNist').onclick = () => download('nist-ai-rmf-checklist-' + today() + '.csv', 'function,id,item,done,evidence_found\n' + NIST.map(n => [n[0], n[1], n[2], S.nist[n[1]] ? 'yes' : 'no', nistAuto(n[1]) ? 'yes' : 'no'].map(csvCell).join(',')).join('\n'), 'text/csv');
  $('#exReg').onclick = () => download('ai-system-register-' + today() + '.csv', 'name,purpose,owner,vendor,model,people,data,risk,eu_ai_act,colorado,oversight,notice,appeal,status,next_review\n' + S.systems.map(s => { const a = assess(s); return [s.name, s.purpose, s.owner, s.vendor, s.model, s.users, s.data, a.risk, a.tier, a.colorado ? 'likely' : 'no', s.oversight, s.notice, s.appeal, s.status, s.nextReview].map(csvCell).join(','); }).join('\n'), 'text/csv');
  $('#exReport').onclick = report;
};
function gaps(s, a) { const g = [], e = sysEvidence(s.id); if (a.risk === 'High' && !e.bias) g.push('no bias test'); if ((a.tier === 'Limited' || a.tier === 'High' || a.colorado) && !s.notice) g.push('no AI notice'); if (a.colorado && !s.appeal) g.push('no appeal path'); if (a.risk === 'High' && !s.oversight) g.push('no human oversight'); if (!s.owner) g.push('no owner'); return g; }
function report() {
  const rows = S.systems.map(s => { const a = assess(s), e = sysEvidence(s.id); return `<tr><td>${esc(s.name)}</td><td>${esc(s.purpose)}</td><td>${esc(s.owner)}</td><td>${a.risk}</td><td>${a.tier}</td><td>${a.colorado ? 'likely' : 'no'}</td><td>${e.bias ? testStatus(e.bias) + ' (' + fmt(e.bias.result.di, 2) + ')' : '—'}</td><td>${e.drift ? testStatus(e.drift) : '—'}</td><td>${esc(gaps(s, a).join('; '))}</td></tr>`; }).join('');
  const html = `<!doctype html><meta charset="utf-8"><title>AI governance report</title><style>body{font:14px system-ui;margin:30px;color:#111}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:6px;text-align:left;vertical-align:top}h1{font-size:22px}</style><h1>AI governance report — ${esc(S.org || 'Organization')}</h1><p>Generated ${new Date().toLocaleString()} with EthosGuard. Self-assessment, not a certification or legal advice.</p><h2>AI systems (${S.systems.length})</h2><table><tr><th>System</th><th>Purpose</th><th>Owner</th><th>Risk</th><th>EU AI Act</th><th>Colorado</th><th>Bias</th><th>Drift</th><th>Gaps</th></tr>${rows}</table><h2>NIST AI RMF checklist: ${nistPct()}%</h2><ul>${NIST.map(n => `<li>${S.nist[n[1]] ? '☑' : '☐'} ${n[1]} ${esc(n[2])}</li>`).join('')}</ul><h2>Incidents (${S.incidents.length})</h2><ul>${S.incidents.map(i => `<li>${esc(i.date)} · ${esc(i.severity)} · ${esc(i.status)} · ${esc(i.title)}</li>`).join('') || '<li>None logged</li>'}</ul><h2>Policies</h2><ul>${S.policies.map(p => `<li>${esc(p.title)} — ${esc(p.status)}</li>`).join('') || '<li>None</li>'}</ul>`;
  download('ai-governance-report-' + today() + '.html', html, 'text/html'); log('Governance report exported');
}

VIEWS.provenance = () => {
  $('#provenance').innerHTML = `<div class="grid g2"><div class="card"><h3>Model lookup (live from Hugging Face)</h3><p>Enter a Hugging Face model id to check its license, task, base model and training datasets.</p>
   <div class="form"><input id="hfId" placeholder="e.g. mistralai/Mistral-7B-Instruct-v0.3" maxlength="200" aria-label="Hugging Face model id"><label>Link to system<select id="hfSys">${sysOptions('', true)}</select></label></div><button class="btn btn-primary big" id="hfGo" style="margin-top:8px">🔎 Look up</button><div id="hfOut"></div>
   ${S.models.length ? `<h3 style="margin-top:16px">Checked models</h3><div class="tw"><table><thead><tr><th>Model</th><th>License</th><th>Task</th><th>System</th><th></th></tr></thead><tbody>${S.models.map((m, i) => `<tr><td><a href="https://huggingface.co/${esc(m.id)}" target="_blank" rel="noopener">${esc(m.id)}</a></td><td>${esc(m.license || 'unknown')} ${badge(licClass(m.license))}</td><td>${esc(m.task || '—')}</td><td>${esc(sysName(m.system) || '—')}</td><td><button class="btn btn-ghost" data-delmodel="${i}">Remove</button></td></tr>`).join('')}</tbody></table></div>` : ''}</div>
   <div class="card"><h3>Package license scan (live from PyPI / npm)</h3><p>Paste a <code>requirements.txt</code> or <code>package.json</code>. EthosGuard looks up each package's declared license and flags copyleft or unknown ones.</p>
   <div class="form"><textarea id="pkgIn" rows="7" aria-label="requirements.txt or package.json" placeholder="numpy==1.26.4&#10;transformers>=4.40&#10;— or paste package.json"></textarea></div><button class="btn btn-primary big" id="pkgGo" style="margin-top:8px">🔎 Scan packages</button><div id="pkgOut"></div></div></div>
   ${S.packages.length ? `<div class="card" style="margin-top:16px"><div class="row sb"><h3>Last package scan (${S.packages.length})</h3><button class="btn btn-ghost" id="pkgCsv">⬇ CSV</button></div><div class="tw"><table><thead><tr><th>Package</th><th>Source</th><th>Latest</th><th>License</th><th>Status</th></tr></thead><tbody>${S.packages.map(p => `<tr><td><b>${esc(p.name)}</b></td><td>${p.eco}</td><td class="muted">${esc(p.version || '—')}</td><td>${esc(p.license || '—')}</td><td>${badge(p.error ? 'Not found' : licClass(p.license))}</td></tr>`).join('')}</tbody></table></div><p class="footer-note">Declared licenses as published by maintainers; dependencies of dependencies are not checked. Copyleft and unknown licenses need legal review before you ship.</p></div>` : ''}`;
  $('#hfGo').onclick = hfLookup; $('#hfId').onkeydown = e => { if (e.key === 'Enter') hfLookup(); };
  $('#pkgGo').onclick = pkgScan;
  const c = $('#pkgCsv'); if (c) c.onclick = () => download('package-licenses-' + today() + '.csv', 'package,ecosystem,latest,license,status\n' + S.packages.map(p => [p.name, p.eco, p.version, p.license, p.error ? 'not found' : licClass(p.license)].map(csvCell).join(',')).join('\n'), 'text/csv');
};
async function hfLookup() {
  const id = $('#hfId').value.trim().replace(/^https?:\/\/huggingface\.co\//, '').replace(/\/(tree|blob)\/.*$/, '').replace(/\/$/, '');
  if (!/^[\w.-]+(\/[\w.-]+)?$/.test(id)) return toast('Enter a model id like owner/model-name');
  const out = $('#hfOut'); out.innerHTML = '<p class="sub">Looking up…</p>'; const sys = $('#hfSys').value;
  try {
    const r = await fetch('https://huggingface.co/api/models/' + id.split('/').map(encodeURIComponent).join('/'));
    if (r.status === 401 || r.status === 404) throw new Error('Model not found (or it is private).'); if (!r.ok) throw new Error('Hugging Face returned ' + r.status);
    const d = await r.json(); const tags = d.tags || [];
    const lic = (d.cardData && d.cardData.license) || (tags.find(t => t.startsWith('license:')) || '').slice(8) || '';
    const m = { id: d.id || d.modelId || id, license: Array.isArray(lic) ? lic.join(', ') : String(lic), task: d.pipeline_tag || '', downloads: d.downloads, likes: d.likes, updated: (d.lastModified || '').slice(0, 10), gated: !!d.gated, base: tags.filter(t => t.startsWith('base_model:')).map(t => t.replace(/^base_model:(\w+:)?/, '')), datasets: tags.filter(t => t.startsWith('dataset:')).map(t => t.slice(8)), card: !!d.cardData, system: sys, at: new Date().toISOString() };
    S.models = S.models.filter(x => !(x.id === m.id && x.system === m.system)); S.models.unshift(m); log(`Model checked: ${m.id} (license ${m.license || 'unknown'})`, m.system); save();
    const html = `<div class="stack" style="margin-top:12px" id="hfResult">${kv('Model', `<a href="https://huggingface.co/${esc(m.id)}" target="_blank" rel="noopener">${esc(m.id)}</a>`)}${kv('License', esc(m.license || 'not stated') + ' ' + badge(licClass(m.license)))}${kv('Task', esc(m.task || '—'))}${kv('Base model', esc(m.base.join(', ') || '—'))}${kv('Training datasets listed', esc(m.datasets.join(', ') || 'none listed — ask the provider'))}${kv('Downloads / likes', (m.downloads ?? '—') + ' / ' + (m.likes ?? '—'))}${kv('Last updated', esc(m.updated))}${kv('Gated', m.gated ? 'yes — terms must be accepted' : 'no')}${kv('Model card', m.card ? 'yes' : 'missing')}</div>`;
    render('provenance'); $('#hfOut').innerHTML = html;
  } catch (e) { out.innerHTML = `<p class="sub" style="color:var(--bad)">${esc(e.message === 'Failed to fetch' ? 'Could not reach Hugging Face. Check your connection.' : e.message)}</p>`; }
}
function parsePkgs(t) {
  t = t.trim(); const out = [];
  if (t.startsWith('{')) { let j; try { j = JSON.parse(t); } catch (e) { throw new Error('That package.json is not valid JSON.'); } Object.keys(Object.assign({}, j.dependencies, j.devDependencies)).forEach(n => out.push({ name: n, eco: 'npm' })); }
  else t.split(/\n/).forEach(l => { l = l.replace(/#.*/, '').trim(); if (!l || l.startsWith('-')) return; const n = l.split(/[\s=<>!~;\[@]/)[0]; if (/^[A-Za-z0-9][\w.-]*$/.test(n)) out.push({ name: n, eco: 'PyPI' }); });
  return out.slice(0, 150);
}
async function pkgScan() {
  let list; try { list = parsePkgs($('#pkgIn').value); } catch (e) { return toast(e.message); }
  if (!list.length) return toast('No packages found in what you pasted.');
  const out = $('#pkgOut'), b = $('#pkgGo'); b.disabled = true; let done = 0;
  const one = async p => {
    try {
      if (p.eco === 'npm') { const r = await fetch('https://registry.npmjs.org/' + p.name.replace('/', '%2F') + '/latest'); if (!r.ok) throw 0; const d = await r.json(); p.version = d.version; p.license = typeof d.license === 'string' ? d.license : (d.license && d.license.type) || ''; }
      else { const r = await fetch('https://pypi.org/pypi/' + encodeURIComponent(p.name) + '/json'); if (!r.ok) throw 0; const d = (await r.json()).info; p.version = d.version; const cls = (d.classifiers || []).filter(c => c.startsWith('License ::')).map(c => c.split('::').pop().trim()); p.license = d.license_expression || (d.license && d.license.length < 60 ? d.license : '') || cls.join(', '); }
    } catch (e) { p.error = true; }
    out.innerHTML = `<p class="sub">Checked ${++done} of ${list.length}…</p>`;
  };
  for (let i = 0; i < list.length; i += 6) await Promise.all(list.slice(i, i + 6).map(one));
  S.packages = list; const flagged = list.filter(p => !p.error && licClass(p.license) !== 'Permissive').length; log(`Package scan: ${list.length} packages, ${flagged} need license review`); save(); b.disabled = false; render('provenance');
}

VIEWS.poisoning = () => {
  const D = loaded.integ;
  $('#poisoning').innerHTML = `<div class="card"><h3>Dataset integrity &amp; poisoning checks (on your device)</h3><p>Load a training or evaluation CSV. EthosGuard checks for duplicates, empty and constant columns, extreme outliers, class imbalance, identical rows with different labels (a sign of label flipping), and text that looks like prompt or script injection.</p>
  <div class="row" style="margin:10px 0">${fileBox('iFile', D ? 'Change CSV' : 'Choose CSV')}<span class="sub">${D ? esc(D.name) + ' · ' + D.rows.length + ' rows' : ''}</span></div>
  ${D ? `<div class="grid g2 form"><label>Label / target column (optional)${colSelect('il', D, -1, '— none —')}</label><label>Link to system<select id="isys">${sysOptions('', true)}</select></label></div><button class="btn btn-primary big" id="runI">▶ Run checks</button>` : ''}<div id="iOut"></div></div>${historyCard('integrity')}`;
  $('#iFile').onchange = ev => loadCSV(ev, 'integ');
  const r = $('#runI'); if (r) r.onclick = () => {
    const res = integrity(D, $('#il').value === '' ? null : +$('#il').value);
    const t = { id: uid(), kind: 'integrity', at: new Date().toISOString(), system: $('#isys').value, file: D.name, result: Object.assign({}, res, { inject: res.inject.slice(0, 20) }) };
    S.tests.unshift(t); log(`Integrity check on ${D.name}: ${res.issues} issue types`, t.system); save(); renderHistory('integrity');
    $('#iOut').innerHTML = `<div style="margin-top:14px"><div class="grid g4"><div class="card"><h3>Rows</h3><div class="metric">${res.n}</div></div><div class="card"><h3>Duplicates</h3><div class="metric">${res.dups}</div></div><div class="card"><h3>Label conflicts</h3><div class="metric">${res.balance == null ? '—' : res.conflicts}</div></div><div class="card"><h3>Injection-like cells</h3><div class="metric">${res.inject.length}</div></div></div>
    <div class="stack" style="margin-top:12px">${res.list.length ? res.list.map(x => `<div class="rec">⚠️ ${esc(x)}</div>`).join('') : '<div class="rec">✅ No integrity problems found by these checks.</div>'}</div>
    ${res.missing.length ? `<h3 style="margin-top:12px">Empty values</h3><p class="sub">${res.missing.map(m => esc(m.col) + ' ' + fmt(m.pct * 100, 1) + '%').join(' · ')}</p>` : ''}
    ${res.constant.length ? `<h3 style="margin-top:12px">Constant columns</h3><p class="sub">${esc(res.constant.join(', '))}</p>` : ''}
    ${res.outliers.length ? `<h3 style="margin-top:12px">Extreme outliers (over 4 standard deviations)</h3><p class="sub">${res.outliers.map(o => esc(o.col) + ': ' + o.count).join(' · ')}</p>` : ''}
    ${res.balance ? `<h3 style="margin-top:12px">Label balance</h3><p class="sub">${res.balance.map(b => esc(b.value || '(blank)') + ' ' + fmt(b.pct * 100, 1) + '%').join(' · ')}</p>` : ''}
    ${res.inject.length ? `<h3 style="margin-top:12px">Suspicious cells</h3><div class="tw"><table><thead><tr><th>Row</th><th>Column</th><th>Text</th></tr></thead><tbody>${res.inject.slice(0, 20).map(x => `<tr><td>${x.row}</td><td>${esc(x.col)}</td><td><code>${esc(x.text)}</code></td></tr>`).join('')}</tbody></table></div>` : ''}</div>`;
  };
};

/* Modal + global clicks */
function modal(html) { $('#modal').innerHTML = html; $('#modalBg').classList.add('open'); }
function closeModal() { $('#modalBg').classList.remove('open'); }
document.addEventListener('click', e => {
  if (e.target.id === 'modalBg') return closeModal();
  const t = e.target.closest('[data-go],[data-sys],[data-close],[data-edit],[data-pol],[data-adopt],[data-inc],[data-deltest],[data-delmodel],[data-explain],[data-ai]'); if (!t) return;
  if (t.dataset.close != null) return closeModal();
  if (t.dataset.go) { show(t.dataset.go); if (t.dataset.new) sysForm(); return; }
  if (t.dataset.sys) return openSystem(t.dataset.sys);
  if (t.dataset.edit) return sysForm(t.dataset.edit);
  if (t.dataset.pol) return polForm(S.policies.find(p => p.id === t.dataset.pol));
  if (t.dataset.adopt) { const T = TEMPLATES[+t.dataset.adopt]; const p = { id: uid(), title: T[0], audience: T[1], status: 'Draft', text: T[2], updated: today() }; S.policies.push(p); log('Policy adopted from template: ' + T[0]); save(); render('policies'); return polForm(p); }
  if (t.dataset.inc) return incForm(S.incidents.find(i => i.id === t.dataset.inc));
  if (t.dataset.deltest) { if (!confirm('Delete this saved test?')) return; const x = S.tests.find(y => y.id === t.dataset.deltest); S.tests = S.tests.filter(y => y !== x); if (x) log(`Deleted ${x.kind} test (${x.file})`, x.system); save(); return render(current); }
  if (t.dataset.delmodel) { S.models.splice(+t.dataset.delmodel, 1); save(); return render('provenance'); }
  if (t.dataset.explain) { const x = S.tests.find(y => y.id === t.dataset.explain); if (x) aiOpen(`Explain this ${x.kind} test result in plain English for a non-expert, say whether it is a problem, and give 3 next steps. Result: ${JSON.stringify(x.kind === 'bias' ? { config: x.cfg, four_fifths_ratio: x.result.di, parity_gap: x.result.dpd, equal_opportunity_gap: x.result.eo, groups: x.result.groups.slice(0, 12) } : x.result).slice(0, 2500)}`); return; }
  if (t.dataset.ai) return aiOpen();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
function aiOpen(q) { closeModal(); if (!window.AIHelper) return toast('AI helper did not load. Check your connection.'); AIHelper.open(q || undefined); }

function setup() {
  $('#orgPill').onclick = () => { const v = prompt('Organization name', S.org || ''); if (v != null) { S.org = v.trim().slice(0, 80); log('Organization name set'); save(); headerRender(); } };
  $('#recBtn').onclick = () => {
    if (!S.systems.length) return aiOpen('I have not registered any AI systems yet. Ask me about the AI my organization uses, then tell me what to register first and the main risks to check.');
    const brief = S.systems.map(s => { const a = assess(s), e = sysEvidence(s.id); return `${s.name} (${s.purpose}; EU tier ${a.tier}; Colorado ${a.colorado ? 'likely high-risk' : 'no'}; bias ${e.bias ? testStatus(e.bias) + ' ratio ' + fmt(e.bias.result.di, 2) : 'untested'}; drift ${e.drift ? testStatus(e.drift) : 'untested'}; gaps: ${gaps(s, a).join(', ') || 'none'})`; }).join('; ');
    aiOpen(`Here is my real AI system register: ${brief}. Open incidents: ${S.incidents.filter(i => i.status !== 'Closed').length}. NIST checklist ${nistPct()}%. Give prioritized governance recommendations for each system, then the single most urgent action overall.`);
  };
  $('#exportBtn').onclick = () => { download('ethosguard-backup-' + today() + '.json', JSON.stringify(S, null, 1), 'application/json'); log('Backup exported'); };
  $('#importIn').onchange = async ev => { const f = ev.target.files[0]; if (!f) return; try { const j = JSON.parse(await readFile(f)); if (!j || !Array.isArray(j.systems)) throw 0; if (!confirm('Replace everything in this browser with the backup?')) return; S = Object.assign(structuredClone(BLANK), j); log('Backup imported from ' + f.name); save(); render(current); toast('Backup restored'); } catch (e) { toast('That is not an EthosGuard backup file.'); } ev.target.value = ''; };
  $('#menuBtn').onclick = () => document.body.classList.toggle('nav-open');
  $('#nav').addEventListener('click', () => document.body.classList.remove('nav-open'));
  addEventListener('hashchange', () => { const h = location.hash.slice(1); if (h && h !== current) show(h); });
}
load(); navRender(); setup(); show(location.hash.slice(1) || 'dashboard');
window.EG = { get state() { return S; }, show };
