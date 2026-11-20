/* منظّم المعلم — النواة: أدوات، تخزين، حالة، توجيه، نوافذ */
'use strict';
var App = window.App = {};
(function(){
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ic = (n, cls='') => `<svg class="${cls}"><use href="#i-${n}"/></svg>`;
const rid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const clone = o => JSON.parse(JSON.stringify(o));
const pad = n => String(n).padStart(2, '0');
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
Object.assign(App, {$, $$, esc, ic, rid, clone, pad, debounce});

/* ---------- Dates ---------- */
const G = new Intl.DateTimeFormat('ar-u-ca-gregory-nu-latn', {weekday:'long', day:'numeric', month:'long', year:'numeric'});
const Gs = new Intl.DateTimeFormat('ar-u-ca-gregory-nu-latn', {day:'numeric', month:'short'});
const Gm = new Intl.DateTimeFormat('ar-u-ca-gregory-nu-latn', {month:'long', year:'numeric'});
const Gw = new Intl.DateTimeFormat('ar-u-ca-gregory-nu-latn', {weekday:'long'});
let H; try { H = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', {day:'numeric', month:'long', year:'numeric'}); } catch(e) { H = null; }
const D = {
  DAYS: ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'],
  ymd: d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`,
  hm: d => `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  parse: s => { if (!s) return null; const [a, b='00:00'] = String(s).split('T'); const [y,m,d] = a.split('-').map(Number); const [h,mi] = b.split(':').map(Number); if (!y) return null; return new Date(y, m-1, d, h||0, mi||0); },
  long: d => G.format(d), short: d => Gs.format(d), month: d => Gm.format(d), wday: d => Gw.format(d),
  hijri: d => { try { return H ? H.format(d) : ''; } catch(e) { return ''; } },
  time12: s => { if (!s) return ''; const [h, m] = s.split(':').map(Number); const p = h < 12 ? 'ص' : 'م'; return `${((h + 11) % 12) + 1}:${pad(m)} ${p}`; },
  sameDay: (a, b) => a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(),
  addDays: (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; },
  startWeek: d => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - x.getDay()); return x; },
  mins: s => { if (!s) return null; const [h, m] = s.split(':').map(Number); return h*60 + (m||0); },
  dur(ms) {
    const late = ms < 0; ms = Math.abs(ms);
    const m = Math.floor(ms / 60000), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
    let s = d > 0 ? `${d} يوم${h ? ' و' + h + ' س' : ''}` : h > 0 ? `${h} س${mm ? ' و' + mm + ' د' : ''}` : `${Math.max(mm, late ? 1 : 0)} دقيقة`;
    if (!late && m < 1) s = 'أقل من دقيقة';
    return late ? 'متأخرة ' + s : 'متبقٍ ' + s;
  },
  fmtDT(s) { const d = D.parse(s); if (!d) return ''; return `${Gs.format(d)} · ${D.time12(D.hm(d))}`; }
};
App.D = D;

/* ---------- Constants ---------- */
App.K = {
  TASK_CATS: ['الأعمال المدرسية','التحضير للدروس','الاختبارات والتصحيح','أعمال اللجان','الخطط والمبادرات','الاجتماعات','متابعة الطلاب','التطوير المهني','أعمال شخصية'],
  PRI: {high:'عالية', mid:'متوسطة', low:'منخفضة'},
  ST: {todo:'لم تبدأ', doing:'قيد التنفيذ', done:'مكتملة'},
  REMIND: [[0,'عند الموعد'],[10,'قبل 10 دقائق'],[30,'قبل 30 دقيقة'],[60,'قبل ساعة'],[180,'قبل 3 ساعات'],[1440,'قبل يوم'],[2880,'قبل يومين'],[10080,'قبل أسبوع'],[-1,'بدون تنبيه'],['c','توقيت مخصص…']],
  EV: {exam:'اختبار', meet:'اجتماع', school:'موعد مدرسي', submit:'تسليم أعمال', activity:'فعالية', occasion:'مناسبة تعليمية', other:'أخرى'},
  LINK_CATS: [['game','ألعاب تفاعلية','game'],['quiz','مسابقات تعليمية','trophy'],['platform','منصات التعلم','book'],['ai','أدوات الذكاء الاصطناعي','spark'],['slides','عروض تقديمية','slides'],['sheet','أوراق العمل','note'],['exam','اختبارات إلكترونية','check'],['doc','ملفات PDF وWord','file'],['video','فيديوهات تعليمية','video'],['site','مواقع تعليمية','globe'],['other','موارد أخرى','link']],
  STAGES: ['الطفولة المبكرة','رياض الأطفال','المرحلة الابتدائية','المرحلة المتوسطة','المرحلة الثانوية','التعليم الجامعي','أخرى'],
  THEMES: [
    {id:'light', name:'Minimal Light', ar:'أبيض بسيط', c:['#f6f7f9','#ffffff','#2f5bea','#151a23']},
    {id:'dark', name:'Midnight Dark', ar:'داكن أنيق', c:['#0f1218','#12151c','#7c9bff','#e9ecf2']},
    {id:'pastel', name:'Soft Pastel', ar:'باستيل هادئ', c:['#fbf7f2','#f3ece3','#e0786a','#2d2a32']},
    {id:'lavender', name:'Lavender', ar:'بنفسجي عصري', c:['#f6f4fb','#2a1f4a','#6d4ad8','#1f1a2e']},
    {id:'ocean', name:'Ocean Blue', ar:'أزرق مريح', c:['#f2f7fa','#0b3b52','#0a7fb0','#0d2633']},
    {id:'forest', name:'Forest Green', ar:'أخضر هادئ', c:['#f4f6f2','#1d3324','#2f7a4a','#17231a']},
    {id:'rose', name:'Rose', ar:'وردي أنيق', c:['#fcf5f6','#ffffff','#c4466a','#2a1519']}
  ],
  DASH: [['alerts','التنبيهات المهمة'],['stats','ملخص سريع'],['today','مهام اليوم'],['late','الأعمال المتأخرة'],['soon','اقترب موعد تسليمها'],['classes','الحصص القادمة'],['progress','نسبة الإنجاز'],['week','مواعيد الأسبوع'],['quick','اختصارات سريعة'],['qnote','ملاحظات سريعة'],['cats','توزيع المهام']],
  CONFIG: {version:'1.0.0', releases:[], devName:'', copyright:'تطوير وتصميم المنصة', announce:'', maintenance:'', defaultTheme:'light', themes:['light','dark','pastel','lavender','ocean','forest','rose'], allowCustom:true, about:''}
};

/* ---------- Toast & modal ---------- */
App.toast = (msg, err) => {
  const t = document.createElement('div'); t.className = 'toast' + (err ? ' err' : '');
  t.innerHTML = (err ? ic('alert') : ic('check')) + `<span>${esc(msg)}</span>`;
  $('#toasts').appendChild(t); setTimeout(() => t.remove(), err ? 5200 : 2800);
};
const modals = [];
App.modal = ({title, body='', foot, wide, onMount, onClose}) => {
  const bg = document.createElement('div'); bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="mh"><h3>${esc(title)}</h3><button class="icon-btn sm" data-x aria-label="إغلاق">${ic('x')}</button></div><div class="mb">${body}</div>${foot !== false ? '<div class="mf"></div>' : ''}</div>`;

  const app = document.getElementById('app');
  // inherit theme variables
  const m = $('.modal', bg);
  m.style.cssText = app.getAttribute('style') || '';
  copyVars(m);
  const api = {el: m, close() { bg.remove(); const i = modals.indexOf(api); if (i > -1) modals.splice(i, 1); onClose && onClose(); if (!modals.length) App.flush(); }};
  $('[data-x]', bg).onclick = () => api.close();
  bg.addEventListener('mousedown', e => { if (e.target === bg) api.close(); });
  if (foot && foot.length) {
    const f = $('.mf', bg);
    foot.forEach(b => {
      if (b === '|') { const s = document.createElement('span'); s.className = 'sp'; f.appendChild(s); return; }
      const btn = document.createElement('button'); btn.className = 'btn ' + (b.cls || ''); btn.innerHTML = (b.icon ? ic(b.icon) : '') + esc(b.label);
      btn.onclick = async () => { if (btn.disabled) return; btn.disabled = true; try { const r = await b.onClick(api, btn); if (r !== false && b.close !== false) api.close(); } catch(e) { console.error(e); App.toast(e.message || 'حدث خطأ غير متوقع', true); } finally { btn.disabled = false; } };
      f.appendChild(btn);
    });
  } else if (foot !== false) $('.mf', bg).remove();
  $('#modalRoot').appendChild(bg); modals.push(api);
  onMount && onMount(m, api);
  const first = $('input:not([type=checkbox]):not([type=file]),textarea,select', m); if (first && matchMedia('(min-width:700px)').matches) setTimeout(() => first.focus(), 30);
  return api;
};
function copyVars(el) {
  const cs = getComputedStyle(document.getElementById('app'));
  ['--bg','--surface','--surface2','--ink','--muted','--line','--accent','--accent-ink','--danger','--warn','--ok','--shadow','--accent-soft','--accent-line','--r','--r-s'].forEach(v => el.style.setProperty(v, cs.getPropertyValue(v)));
  el.style.colorScheme = cs.colorScheme;
}
App.anyModal = () => modals.length > 0;
App.confirm = (msg, ok='حذف', danger=true) => new Promise(res => {
  let done = false;
  App.modal({title:'تأكيد', body:`<p style="margin:0">${esc(msg)}</p>`, foot:[{label:ok, cls: danger ? 'primary' : 'primary', onClick(){ done = true; res(true); }}, {label:'إلغاء', cls:'ghost', onClick(){}}], onClose(){ if (!done) res(false); }});
});
App.prompt = (title, value='', label='') => new Promise(res => {
  let v = null;
  App.modal({title, body:`<label class="f"><span>${esc(label)}</span><input id="pv" value="${esc(value)}"></label>`, foot:[{label:'حفظ', cls:'primary', onClick(m){ v = $('#pv', m.el).value.trim(); if (!v) { App.toast('اكتبي قيمة', true); return false; } }}, {label:'إلغاء', cls:'ghost', onClick(){}}], onMount(m){ const i = $('#pv', m); i.addEventListener('keydown', e => { if (e.key === 'Enter') $('.mf .primary', m).click(); }); setTimeout(() => i.focus(), 40); }, onClose(){ res(v); }});
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && modals.length) modals[modals.length-1].close(); });

/* ---------- Storage (Supabase in production, browser storage in trial mode) ---------- */
const COLLS = ['tasks','events','links','lfolders','schedules','plans','notes','files','ffolders','meta','chunks'];
const S = App.S = {mode:'none', uid:null, email:'', isOwner:false, readOnly:false, profile:null, quick:{text:''}, notifs:{items:[]}, config:clone(App.K.CONFIG), loaded:{}};
COLLS.forEach(c => { if (c !== 'meta') S[c] = []; });

const Cache = {}; COLLS.forEach(c => Cache[c] = new Map());
const subs = {};
const emit = c => { subs[c] && subs[c](Array.from(Cache[c].values())); };
const Store = App.Store = {
  mode:'none', sb:null, chains:{},
  chain(key, fn) { const p = (Store.chains[key] || Promise.resolve()).then(fn, fn); Store.chains[key] = p.catch(() => {}); return p; },
  async put(coll, obj) {
    if (!obj.id) obj.id = rid();
    obj.updatedAt = Date.now(); if (!obj.createdAt) obj.createdAt = obj.updatedAt;
    const data = clone(obj);
    if (Store.mode === 'local') { Local.set(coll, data); return obj; }
    const prev = Cache[coll].get(data.id);
    Cache[coll].set(data.id, data); emit(coll);
    try {
      await Store.chain(coll + '/' + data.id, async () => {
        const {error} = await Store.sb.from('items').upsert({user_id: S.uid, coll, id: data.id, data, updated_at: new Date().toISOString()});
        if (error) throw error;
      });
    } catch(e) { if (prev) Cache[coll].set(data.id, prev); else Cache[coll].delete(data.id); emit(coll); Store.fail(e); throw e; }
    return obj;
  },
  async del(coll, id) {
    if (Store.mode === 'local') { Local.del(coll, id); return; }
    const prev = Cache[coll].get(id); Cache[coll].delete(id); emit(coll);
    try { await Store.chain(coll + '/' + id, async () => { const {error} = await Store.sb.from('items').delete().match({user_id: S.uid, coll, id}); if (error) throw error; }); }
    catch(e) { if (prev) { Cache[coll].set(id, prev); emit(coll); } Store.fail(e); throw e; }
  },
  async query(coll, field, val) {
    if (Store.mode === 'local') return Object.values(Local.all(coll)).filter(x => x[field] === val);
    return Array.from(Cache[coll].values()).filter(x => x[field] === val);
  },
  fail(e) {
    console.error(e);
    const m = String((e && (e.message || e.error_description)) || '');
    const msg = /fetch|network|Failed to fetch/i.test(m) ? 'تعذّر الاتصال بالخادم. تحققي من الإنترنت وأعيدي المحاولة.'
      : /JWT|expired|401/i.test(m) ? 'انتهت الجلسة. سجّلي الدخول من جديد.'
      : /quota|limit|exceed|too large|413/i.test(m) ? 'تجاوزتِ حد التخزين أو حجم الملف المسموح.'
      : /row-level|permission|403/i.test(m) ? 'لا تملكين صلاحية هذا الإجراء.'
      : 'تعذّر حفظ البيانات. أعيدي المحاولة.';
    App.toast(msg, true);
  },
  watch(coll, cb) {
    if (Store.mode === 'local') { Local.subs[coll] = cb; cb(Object.values(Local.all(coll))); return; }
    subs[coll] = cb; cb(Array.from(Cache[coll].values()));
  },
  async loadAll() {
    let from = 0; const page = 1000;
    for (;;) {
      const {data, error} = await Store.sb.from('items').select('coll,id,data').eq('user_id', S.uid).neq('coll', 'chunks').range(from, from + page - 1);
      if (error) throw error;
      data.forEach(r => { if (Cache[r.coll]) Cache[r.coll].set(r.id, r.data); });
      if (data.length < page) break; from += page;
    }
    COLLS.forEach(c => S.loaded[c] = true);
  },
  live() {
    Store.sb.channel('items-' + S.uid).on('postgres_changes', {event:'*', schema:'public', table:'items', filter:'user_id=eq.' + S.uid}, p => {
      const row = p.eventType === 'DELETE' ? p.old : p.new; if (!row || !row.coll || !Cache[row.coll] || row.coll === 'chunks') return;
      if (p.eventType === 'DELETE') Cache[row.coll].delete(row.id);
      else { const cur = Cache[row.coll].get(row.id); if (cur && (cur.updatedAt || 0) > ((row.data || {}).updatedAt || 0)) return; Cache[row.coll].set(row.id, row.data); }
      emit(row.coll);
    }).subscribe();
    // catch up after the device wakes or reconnects
    document.addEventListener('visibilitychange', App.debounce(async () => {
      if (document.visibilityState !== 'visible') return;
      try { COLLS.forEach(c => Cache[c].clear()); await Store.loadAll(); COLLS.forEach(emit); } catch(e) {}
    }, 400));
  }
};
const Local = {
  subs:{}, mem:{},
  key: c => 'teacherhub:' + c,
  all(c) { if (this.mem[c]) return this.mem[c]; let v = {}; try { v = JSON.parse(localStorage.getItem(this.key(c)) || '{}'); } catch(e) {} return this.mem[c] = v; },
  save(c) { try { localStorage.setItem(this.key(c), JSON.stringify(this.mem[c])); } catch(e) { App.toast('مساحة المتصفح ممتلئة؛ لم يُحفظ آخر تعديل.', true); } this.subs[c] && this.subs[c](Object.values(this.mem[c])); },
  set(c, o) { this.all(c)[o.id] = o; this.save(c); },
  del(c, id) { delete this.all(c)[id]; this.save(c); }
};
App.Local = Local;

/* meta documents (profile / quick note / notifications) */
App.saveMeta = async (id, obj) => { obj.id = id; return Store.put('meta', obj); };
App.saveProfile = async patch => { S.profile = Object.assign({}, S.profile || {}, patch); await App.saveMeta('profile', S.profile); App.applyTheme(); App.updateRegistry(true); };

/* global config (developer controlled) */
App.saveConfig = async patch => {
  const next = Object.assign({}, S.config, patch, {updatedAt: Date.now()});
  if (Store.mode === 'local') { try { localStorage.setItem('teacherhub:config', JSON.stringify(next)); } catch(e) {} S.config = next; App.applyTheme(); App.banner(); App.flush(); return; }
  const {error} = await Store.sb.from('config').update({data: next, updated_at: new Date().toISOString()}).eq('id', 1);
  if (error) { Store.fail(error); throw error; }
  S.config = next; App.applyTheme(); App.banner(); App.flush();
};

/* registry: one row per teacher, readable only by her and the developer (row level security) */
App.updateRegistry = async force => {
  if (Store.mode !== 'cloud' || !S.profile || !S.profile.name) return;
  const p = S.profile;
  const row = {user_id: S.uid, name:p.name, school:p.school||'', subject:p.subject||'', stage:p.stage||'', phone:p.phone||'', email:p.email || (App.isCodeAccount && App.isCodeAccount() ? '' : S.email) || '', theme:p.theme||'', last_active:new Date().toISOString(),
    counts:{tasks:S.tasks.length, done:S.tasks.filter(t => t.status === 'done').length, plans:S.plans.length, notes:S.notes.length, links:S.links.length, files:S.files.length, events:S.events.length, schedules:S.schedules.length}};
  const sig = JSON.stringify([row.name,row.school,row.subject,row.stage,row.phone,row.email,row.theme,row.counts]);
  if (!force && sig === App._regSig && Date.now() - (App._regAt||0) < 30*60000) return;
  App._regSig = sig; App._regAt = Date.now();
  try { const {error} = await Store.sb.from('profiles').upsert(row); if (error) throw error; } catch(e) { console.warn('registry', e); }
};

/* ---------- Files (Supabase Storage in production, chunked browser storage in trial mode) ---------- */
const CHUNK = 180000;
App.fileKind = (name, type='') => {
  const e = (name.split('.').pop() || '').toLowerCase();
  if (type.startsWith('image/') || ['png','jpg','jpeg','gif','webp','svg','heic'].includes(e)) return 'img';
  if (e === 'pdf' || type === 'application/pdf') return 'pdf';
  if (['doc','docx','odt','rtf'].includes(e)) return 'doc';
  if (['xls','xlsx','csv','ods'].includes(e)) return 'xls';
  if (['ppt','pptx','odp','key'].includes(e)) return 'ppt';
  return 'oth';
};
App.fsize = b => b < 1024 ? b + ' بايت' : b < 1048576 ? (b/1024).toFixed(0) + ' ك.ب' : (b/1048576).toFixed(1) + ' م.ب';
App.MAX_FILE = () => Store.mode === 'local' ? 2 * 1048576 : 25 * 1048576;
const b64 = buf => { let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = s => { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
App.b64 = b64;

App.uploadFile = async (file, folder='', onProg) => {
  if (file.size > App.MAX_FILE()) throw new Error(`حجم الملف «${file.name}» أكبر من الحد المسموح (${App.fsize(App.MAX_FILE())}).`);
  const rec = {id: rid(), name: file.name, size: file.size, type: file.type || '', kind: App.fileKind(file.name, file.type), folder};
  if (Store.mode === 'cloud') {
    onProg && onProg('جارٍ الرفع…');
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin';
    rec.store = 'sb'; rec.path = `${S.uid}/${rec.id}.${ext}`;
    const {error} = await Store.sb.storage.from('files').upload(rec.path, file, {contentType: file.type || 'application/octet-stream', upsert: false});
    if (error) throw new Error(/size|large|413/i.test(error.message || '') ? 'حجم الملف أكبر من المسموح' : 'تعذّر رفع الملف: ' + (error.message || ''));
  } else {
    const data = b64(await file.arrayBuffer());
    const n = Math.ceil(data.length / CHUNK) || 1; rec.store = 'db'; rec.chunks = n;
    for (let i = 0; i < n; i++) { onProg && onProg(`جارٍ الرفع ${Math.round((i / n) * 100)}%`); await Store.put('chunks', {id: rec.id + '_' + i, fid: rec.id, i, d: data.slice(i * CHUNK, (i + 1) * CHUNK)}); }
  }
  try { await Store.put('files', rec); }
  catch(e) { if (rec.store === 'sb') await Store.sb.storage.from('files').remove([rec.path]); throw e; }
  onProg && onProg('تم');
  return rec;
};
App.fileBlob = async f => {
  if (f.store === 'sb') { const {data, error} = await Store.sb.storage.from('files').download(f.path); if (error) throw new Error('تعذّر جلب الملف'); return data; }
  const parts = (await Store.query('chunks', 'fid', f.id)).sort((a, b) => a.i - b.i);
  if (parts.length < (f.chunks || 1)) throw new Error('الملف غير مكتمل في التخزين');
  return new Blob([unb64(parts.map(p => p.d).join(''))], {type: f.type || 'application/octet-stream'});
};
const urlCache = new Map();
App.fileUrl = async f => {
  const c = urlCache.get(f.id); if (c && c.exp > Date.now()) return c.url;
  let url;
  if (f.store === 'sb') { const {data, error} = await Store.sb.storage.from('files').createSignedUrl(f.path, 3600); if (error) throw new Error('تعذّر فتح الملف'); url = data.signedUrl; }
  else url = URL.createObjectURL(await App.fileBlob(f));
  urlCache.set(f.id, {url, exp: Date.now() + 50 * 60000}); return url;
};
App.deleteFile = async f => {
  if (f.store === 'sb') { const {error} = await Store.sb.storage.from('files').remove([f.path]); if (error) console.warn(error); }
  if (f.store === 'db') { for (let i = 0; i < (f.chunks || 1); i++) await Store.del('chunks', f.id + '_' + i); }
  await Store.del('files', f.id);
};
App.save = async (filename, data) => {
  try {
    const blob = data instanceof Blob ? data : new Blob([data], {type: /\.html$/.test(filename) ? 'text/html;charset=utf-8' : /\.csv$/.test(filename) ? 'text/csv;charset=utf-8' : /\.json$/.test(filename) ? 'application/json' : 'application/octet-stream'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  } catch(e) { App.toast('تعذّر التنزيل', true); }
};
App.downloadFile = async f => { try { App.toast('جارٍ التجهيز…'); await App.save(f.name, await App.fileBlob(f)); } catch(e) { App.toast(e.message, true); } };


/* ---------- PDF page rendering (first page as an image) ---------- */
const pdfCache = new Map();
App.loadPdfLib = () => App._pdfLib || (App._pdfLib = new Promise((res, rej) => {
  const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/legacy/build/pdf.min.js';
  s.onload = () => { try { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/legacy/build/pdf.worker.min.js'; res(window.pdfjsLib); } catch(e) { rej(e); } };
  s.onerror = () => { App._pdfLib = null; rej(new Error('تعذّر تحميل قارئ PDF')); }; document.head.appendChild(s);
}));
App.pdfToCanvas = async (blob, maxSide=2200) => {
  const lib = await App.loadPdfLib();
  const pdf = await lib.getDocument({data: new Uint8Array(await blob.arrayBuffer())}).promise;
  const page = await pdf.getPage(1); const vp0 = page.getViewport({scale: 1}); const scale = Math.min(3, maxSide / Math.max(vp0.width, vp0.height));
  const vp = page.getViewport({scale}); const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
  const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  await page.render({canvasContext: ctx, viewport: vp}).promise; return c;
};
App.pdfImage = async f => {
  if (pdfCache.has(f.id)) return pdfCache.get(f.id);
  const p = (async () => { const c = await App.pdfToCanvas(await App.fileBlob(f), 1800); return c.toDataURL('image/jpeg', 0.88); })();
  pdfCache.set(f.id, p); p.catch(() => pdfCache.delete(f.id)); return p;
};
/* put a picture of an image or the first PDF page into a box */
App.fillThumb = async (box, f, fit='cover') => {
  try {
    const src = f.kind === 'img' ? await App.fileUrl(f) : f.kind === 'pdf' ? await App.pdfImage(f) : null;
    if (!src || !box.isConnected) return;
    box.innerHTML = `<img alt="${App.esc(f.name)}" src="${App.esc(src)}" style="width:100%;${fit === 'auto' ? 'height:auto;' : 'height:100%;'}object-fit:${fit === 'auto' ? 'contain' : fit};display:block">`;
  } catch(e) { console.warn('thumb', e); }
};

/* ---------- Notifications ---------- */
App.notify = async (n, important) => {
  const item = Object.assign({id: rid(), at: Date.now(), read: false, important: !!important}, n);
  const items = [item].concat(S.notifs.items || []).slice(0, 150);
  S.notifs = {items}; App.flush();
  try { await App.saveMeta('notifs', {items}); } catch(e) {}
  try { if ('Notification' in window && Notification.permission === 'granted') new Notification(item.title, {body: item.body || '', tag: item.id}); } catch(e) {}
};
App.markRead = async (ids) => {
  const set = ids === 'all' ? null : new Set(ids);
  let changed = false;
  const items = (S.notifs.items || []).map(n => { if (!n.read && (!set || set.has(n.id))) { changed = true; return Object.assign({}, n, {read: true}); } return n; });
  if (!changed) return;
  S.notifs = {items}; App.flush(); try { await App.saveMeta('notifs', {items}); } catch(e) {}
};
App.unread = () => (S.notifs.items || []).filter(n => !n.read).length;

/* ---------- Theme ---------- */
App.applyTheme = () => {
  const app = document.getElementById('app');
  const cfg = S.config, p = S.profile || {};
  let t = p.theme || cfg.defaultTheme || 'light';
  if (!p.theme && document.documentElement.dataset.theme === 'dark') t = 'dark';
  if (cfg.themes && cfg.themes.length && !cfg.themes.includes(t)) t = cfg.defaultTheme || cfg.themes[0];
  app.dataset.t = t;
  app.style.removeProperty('--accent'); app.style.removeProperty('--accent-ink');
  if (p.accent && cfg.allowCustom !== false) {
    app.style.setProperty('--accent', p.accent);
    const h = p.accent.replace('#', ''); const r = parseInt(h.substr(0,2),16), g = parseInt(h.substr(2,2),16), b = parseInt(h.substr(4,2),16);
    app.style.setProperty('--accent-ink', (r*299 + g*587 + b*114) / 1000 > 160 ? '#111' : '#fff');
  }
  try { localStorage.setItem('teacherhub:theme', JSON.stringify({t, a: p.accent || ''})); } catch(e) {}
  const meta = document.querySelector('meta[name=theme-color]'); if (meta) meta.content = getComputedStyle(app).getPropertyValue('--accent').trim() || '#2f5bea';
};
try { const c = JSON.parse(localStorage.getItem('teacherhub:theme') || 'null'); if (c) { document.getElementById('app').dataset.t = c.t; if (c.a) document.getElementById('app').style.setProperty('--accent', c.a); } } catch(e) {}

/* ---------- Router & render ---------- */
App.views = {};
App.view = (name, def) => { App.views[name] = def; };
App.route = () => { const h = (location.hash || '').replace('#', ''); return App.views[h] && (!App.views[h].guard || App.views[h].guard()) ? h : 'dashboard'; };
App.go = name => { if (location.hash === '#' + name) App.render(); else location.hash = name; };
let raf = 0, dirty = false;
App.flush = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; App.render(true); }); };
App.render = (fromData) => {
  if (!S.ready || !S.profile || !S.profile.name) return;
  if (fromData && App.anyModal()) { dirty = true; App.chrome(); return; }
  const el = $('#view'); const name = App.route(); const v = App.views[name];
  // keep focus/caret of an input that survives re-render
  const ae = document.activeElement; let keep = null;
  if (ae && ae.id && el.contains(ae) && /INPUT|TEXTAREA|SELECT/.test(ae.tagName)) keep = {id: ae.id, s: ae.selectionStart, e: ae.selectionEnd};
  if (fromData && ae && el.contains(ae) && ae.dataset.nore != null) { App.chrome(); return; }
  const sy = window.scrollY;
  if (App._last !== name) { App._last = name; window.scrollTo(0, 0); }
  try { v.render(el); } catch(e) { console.error(e); el.innerHTML = `<div class="empty"><div class="ill">${ic('alert')}</div><b>حدث خطأ أثناء عرض الصفحة</b><p>${esc(e.message)}</p><button class="btn" onclick="location.reload()">إعادة التحميل</button></div>`; }
  if (fromData) window.scrollTo(0, sy);
  if (keep) { const n = document.getElementById(keep.id); if (n) { n.focus(); try { if (keep.s != null) n.setSelectionRange(keep.s, keep.e); } catch(e) {} } }
  dirty = false; App.chrome();
};
window.addEventListener('hashchange', () => { document.getElementById('app').classList.remove('menu-open'); App.render(); });

const NAV = [['dashboard','الرئيسية','home'],['tasks','المهام','check'],['calendar','التقويم','cal'],['schedules','الجداول','grid'],['plans','الخطط والمبادرات','target'],['links','الروابط والموارد','link'],['files','الملفات','folder'],['notes','المفكرة','note'],'-',['notifications','الإشعارات','bell'],['account','حسابي والثيمات','user'],['about','حول المنصة','info']];
App.chrome = () => {
  const cur = App.route(); const un = App.unread();
  const lateN = S.tasks.filter(App.isLate).length;
  const nav = NAV.map(n => n === '-' ? '<div class="sep"></div>' : `<a href="#${n[0]}" class="${cur === n[0] ? 'on' : ''}">${ic(n[2])}<span>${n[1]}</span>${n[0] === 'notifications' && un ? `<span class="count">${un}</span>` : n[0] === 'tasks' && lateN ? `<span class="count">${lateN}</span>` : ''}</a>`).join('')
    + (S.isOwner ? `<div class="sep"></div><a href="#admin" class="${cur === 'admin' ? 'on' : ''}">${ic('shield')}<span>لوحة المطور</span></a>` : '');
  const navEl = $('#nav'); if (navEl.innerHTML !== nav) navEl.innerHTML = nav;
  const p = S.profile || {};
  const foot = p.name ? `<a class="me" href="#account" style="color:inherit;text-decoration:none"><span class="avatar">${esc((p.name || '؟').trim().charAt(0))}</span><span style="min-width:0"><b>${esc(p.name)}</b><small>${esc(p.school || p.subject || '')}</small></span></a>` : '';
  if ($('#sideFoot').innerHTML !== foot) $('#sideFoot').innerHTML = foot;
  const bn = [['dashboard','الرئيسية','home'],['tasks','المهام','check'],['calendar','التقويم','cal'],['schedules','الجداول','grid']];
  const bottom = bn.map(n => `<a href="#${n[0]}" class="${cur === n[0] ? 'on' : ''}">${ic(n[2])}<span>${n[1]}</span></a>`).join('') + `<button id="moreBtn" class="${['dashboard','tasks','calendar','schedules'].includes(cur) ? '' : 'on'}">${ic('more')}<span>المزيد</span></button>`;
  if ($('#bottom').innerHTML !== bottom) { $('#bottom').innerHTML = bottom; $('#moreBtn').onclick = () => document.getElementById('app').classList.add('menu-open'); }
  $('#pageTitle').textContent = (App.views[cur] && App.views[cur].title) || '';
  document.title = ((App.views[cur] && App.views[cur].title) || '') + ' · منظّم المعلم';
  const dot = $('#bellDot'); dot.hidden = !un; dot.textContent = un > 99 ? '99+' : un;
  const cfg = S.config; const yr = new Date().getFullYear();
  const f = `© ${yr} جميع الحقوق محفوظة | ${esc(cfg.copyright || 'تطوير وتصميم المنصة')}${cfg.devName ? ' · ' + esc(cfg.devName) : ''} · <a href="#about">الإصدار ${esc(cfg.version || '1.0.0')}</a>`;
  if ($('#foot').innerHTML !== f) $('#foot').innerHTML = f;
};
App.banner = () => {
  const b = [];
  if (Store.mode === 'local') b.push(`<div class="bn">${ic('alert')}<span>وضع التجربة: لم تُربط المنصة بقاعدة البيانات بعد، فالبيانات تُحفظ في هذا المتصفح فقط. أكملي إعداد Supabase في ملف config.js للحفظ الدائم والمزامنة.</span></div>`);
  if (S.offline) b.push(`<div class="bn">${ic('clock')}<span>لا يوجد اتصال بالإنترنت. ستظهر التعديلات الجديدة بعد عودة الاتصال.</span></div>`);
  const c = S.config;
  if (c.maintenance) b.push(`<div class="bn">${ic('alert')}<span>${esc(c.maintenance)}</span></div>`);
  if (c.announce) b.push(`<div class="bn info">${ic('info')}<span>${esc(c.announce)}</span></div>`);
  $('#banner').innerHTML = b.join('');
};

/* ---------- Shared helpers for views ---------- */
App.isLate = t => t.status !== 'done' && t.due && D.parse(t.due) < new Date();
App.cdHTML = (due, done) => {
  if (!due || done) return '';
  const ms = D.parse(due) - Date.now();
  return `<span class="cd ${ms < 0 ? 'late' : ms < 86400000 ? 'soon' : ''}" data-cd="${esc(due)}">${D.dur(ms)}</span>`;
};
App.tickCountdowns = () => { $$('[data-cd]').forEach(s => { const ms = D.parse(s.dataset.cd) - Date.now(); const txt = D.dur(ms); if (s.textContent !== txt) s.textContent = txt; s.classList.toggle('late', ms < 0); s.classList.toggle('soon', ms >= 0 && ms < 86400000); }); };
App.empty = (icon, title, text, btn) => `<div class="empty"><div class="ill">${ic(icon)}</div><b>${esc(title)}</b><p>${esc(text)}</p>${btn || ''}</div>`;
App.opts = (obj, sel) => (Array.isArray(obj) ? obj.map(x => Array.isArray(x) ? x : [x, x]) : Object.entries(obj)).map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(sel) ? 'selected' : ''}>${esc(l)}</option>`).join('');
App.val = (root, sel) => { const e = $(sel, root); return e ? e.value.trim() : ''; };

/* dynamic list editor (subtasks, steps, goals, checklist) */
App.dynList = (items, {ph='', check=false, extra} = {}) => `<div class="dyn" data-dyn>${(items || []).map(it => App.dynRow(it, {ph, check, extra})).join('')}</div><button type="button" class="btn sm ghost" data-dyn-add data-ph="${esc(ph)}" data-check="${check ? 1 : ''}" data-extra="${extra || ''}">${ic('plus')}إضافة</button>`;
App.dynRow = (it, {ph='', check=false, extra} = {}) => {
  it = typeof it === 'string' ? {text: it} : (it || {});
  return `<div class="dr">${check ? `<input type="checkbox" ${it.done ? 'checked' : ''} aria-label="منجز">` : ''}<input type="text" value="${esc(it.text || '')}" placeholder="${esc(ph)}">${extra === 'date' ? `<input type="date" value="${esc(it.due || '')}" style="max-width:150px" aria-label="التاريخ">` : ''}${extra === 'kpi' ? `<input type="text" data-k="target" value="${esc(it.target || '')}" placeholder="المستهدف" style="max-width:110px"><input type="text" data-k="actual" value="${esc(it.actual || '')}" placeholder="المتحقق" style="max-width:110px">` : ''}<button type="button" class="icon-btn sm" data-dyn-del aria-label="حذف">${ic('x')}</button></div>`;
};
App.bindDyn = root => {
  root.addEventListener('click', e => {
    const add = e.target.closest('[data-dyn-add]'); const del = e.target.closest('[data-dyn-del]');
    if (add) { const list = add.previousElementSibling; list.insertAdjacentHTML('beforeend', App.dynRow({}, {ph: add.dataset.ph, check: !!add.dataset.check, extra: add.dataset.extra})); const ins = list.lastElementChild.querySelector('input[type=text]'); ins && ins.focus(); }
    if (del) del.closest('.dr').remove();
  });
  root.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('.dyn input[type=text]')) { e.preventDefault(); const dyn = e.target.closest('[data-dyn]'); dyn.nextElementSibling.click(); } });
};
App.readDyn = (root, sel) => {
  const wrap = sel ? $(sel, root) : root; if (!wrap) return [];
  return $$('.dr', $('[data-dyn]', wrap) || wrap).map(r => {
    const txt = $('input[type=text]:not([data-k])', r).value.trim(); if (!txt) return null;
    const o = {text: txt}; const cb = $('input[type=checkbox]', r); if (cb) o.done = cb.checked;
    const d = $('input[type=date]', r); if (d) o.due = d.value;
    $$('[data-k]', r).forEach(k => o[k.dataset.k] = k.value.trim());
    return o;
  }).filter(Boolean);
};

/* attachment picker: choose from library or upload new; returns ids */
App.attField = (ids=[], links) => `<div class="att" data-att='${esc(JSON.stringify(ids))}'><div class="att-list"></div><div class="row wrap" style="margin-top:8px"><button type="button" class="btn sm" data-att-up>${ic('upload')}رفع ملف</button><button type="button" class="btn sm ghost" data-att-pick>${ic('folder')}من مكتبة الملفات</button><input type="file" multiple hidden data-att-input></div></div>`;
App.bindAtt = (root, folderName) => {
  const box = $('.att', root); if (!box) return;
  const get = () => JSON.parse(box.dataset.att || '[]'); const set = v => { box.dataset.att = JSON.stringify(v); draw(); };
  const draw = () => { $('.att-list', box).innerHTML = get().map(id => { const f = S.files.find(x => x.id === id); return f ? `<div class="a"><span class="ficon ${f.kind}" style="width:30px;height:30px;font-size:9px">${f.kind.toUpperCase()}</span><span>${esc(f.name)}</span><button type="button" class="icon-btn sm" data-rm="${id}" aria-label="إزالة">${ic('x')}</button></div>` : ''; }).join(''); };
  draw();
  box.addEventListener('click', async e => {
    const rm = e.target.closest('[data-rm]'); if (rm) set(get().filter(x => x !== rm.dataset.rm));
    if (e.target.closest('[data-att-up]')) $('[data-att-input]', box).click();
    if (e.target.closest('[data-att-pick]')) {
      if (!S.files.length) { App.toast('مكتبة الملفات فارغة، ارفعي ملفًا أولًا'); return; }
      App.modal({title:'اختيار من مكتبة الملفات', body:`<div class="search" style="margin-bottom:10px">${ic('search')}<input id="pq" placeholder="ابحثي باسم الملف"></div><div class="items" id="pl"></div>`, onMount(m, api) {
        const list = () => { const q = $('#pq', m).value.trim(); $('#pl', m).innerHTML = S.files.filter(f => !q || f.name.includes(q)).map(f => `<label class="item" style="cursor:pointer"><input type="checkbox" value="${f.id}" ${get().includes(f.id) ? 'checked' : ''}><span class="ficon ${f.kind}" style="width:32px;height:32px;font-size:9px">${f.kind.toUpperCase()}</span><span class="body t">${esc(f.name)}</span></label>`).join(''); };
        list(); $('#pq', m).oninput = list;
      }, foot:[{label:'تم', cls:'primary', onClick(api){ const chosen = $$('#pl input:checked', api.el).map(i => i.value); const shown = $$('#pl input', api.el).map(i => i.value); set(get().filter(x => !shown.includes(x)).concat(chosen)); }}]});
    }
  });
  $('[data-att-input]', box).addEventListener('change', async e => {
    const files = Array.from(e.target.files); e.target.value = '';
    for (const f of files) {
      try { App.toast('جارٍ رفع ' + f.name); const folder = await App.ensureFolder(folderName); const rec = await App.uploadFile(f, folder); set(get().concat(rec.id)); }
      catch(err) { App.toast(err.message || 'تعذّر رفع الملف', true); }
    }
  });
};
App.readAtt = root => { const b = $('.att', root); return b ? JSON.parse(b.dataset.att || '[]') : []; };
App.ensureFolder = async name => {
  if (!name) return '';
  let f = S.ffolders.find(x => x.name === name);
  if (!f) { f = await Store.put('ffolders', {name}); S.ffolders.push(f); }
  return f.id;
};
App.attChips = ids => (ids || []).map(id => S.files.find(f => f.id === id)).filter(Boolean).map(f => `<button type="button" class="chip" data-open-file="${f.id}">${ic('file')}${esc(f.name)}</button>`).join('');
App.linkChips = links => (links || []).filter(Boolean).map(u => `<a class="chip" href="${esc(App.safeUrl(u))}" target="_blank" rel="noopener">${ic('link')}<span style="direction:ltr">${esc(u.replace(/^https?:\/\//, '').slice(0, 40))}</span></a>`).join('');
App.safeUrl = u => { u = String(u || '').trim(); if (!u) return '#'; if (!/^https?:\/\//i.test(u)) u = 'https://' + u; try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : '#'; } catch(e) { return '#'; } };
document.addEventListener('click', e => { const b = e.target.closest('[data-open-file]'); if (b) { const f = S.files.find(x => x.id === b.dataset.openFile); if (f && App.previewFile) App.previewFile(f); } });
})();
