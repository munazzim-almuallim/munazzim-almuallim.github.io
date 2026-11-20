/* التشغيل: تسجيل الدخول، تحميل البيانات، المزامنة، المؤقت والتنبيهات */
'use strict';
(function(){
const {$, esc, ic, D, S, Store} = App;
const view = $('#view'); const app = document.getElementById('app');
view.innerHTML = `<div class="loader"><div class="spin"></div><span>جارٍ فتح مكتبك الرقمي…</span></div>`;

$('#menuBtn').onclick = () => app.classList.add('menu-open');
$('#scrim').onclick = () => app.classList.remove('menu-open');
$('#quickAddBtn').onclick = () => S.ready && S.profile && App.quickAdd();
$('#bellBtn').onclick = () => App.go('notifications');
$('#searchBtn').onclick = () => S.ready && App.globalSearch();
document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && S.ready) { e.preventDefault(); App.globalSearch(); } });

const CFG = window.TEACHER_HUB_CONFIG || {};
const configured = CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && window.supabase;

/* ---------- Auth screens ---------- */
const authShell = inner => { app.classList.add('auth'); view.innerHTML = `<div class="auth-wrap"><div class="auth-card card"><div class="brand" style="padding:0 0 14px"><span class="logo" aria-hidden="true"><svg viewBox="0 0 32 32"><rect x="3" y="5" width="26" height="22" rx="6" fill="currentColor" opacity=".16"/><path d="M9 12h14M9 17h9M9 22h5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" fill="none"/><circle cx="23" cy="21" r="4" fill="currentColor"/></svg></span><div><b>منظّم المعلم</b><small>مكتبك الرقمي في مكان واحد</small></div></div>${inner}</div></div>`; try { App.chrome(); $('#pageTitle').textContent = ''; } catch(e) {} };
const errAr = m => /Invalid login/i.test(m) ? 'البريد أو كلمة المرور غير صحيحة.' : /already registered|already exists/i.test(m) ? 'هذا البريد مسجّل مسبقًا. سجّلي الدخول بدلًا من ذلك.' : /Email not confirmed/i.test(m) ? 'لم يتم تأكيد البريد بعد. افتحي رسالة التأكيد في بريدك.' : /Password should be|at least/i.test(m) ? 'كلمة المرور قصيرة؛ استخدمي 8 أحرف على الأقل.' : /rate limit|too many/i.test(m) ? 'محاولات كثيرة، انتظري قليلًا ثم أعيدي المحاولة.' : /valid email|invalid email/i.test(m) ? 'صيغة البريد غير صحيحة.' : /fetch|network/i.test(m) ? 'تعذّر الاتصال بالخادم. تحققي من الإنترنت.' : 'حدث خطأ: ' + m;
/* teachers sign in with their name + a 4-digit PIN they choose; behind the scenes each gets a private account */
const DOMAIN = '@teachers.teacherhub.app';
const normName = n => String(n || '').replace(/[ً-ْـ]/g, '').replace(/[إأآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/\s+/g, ' ').trim().toLowerCase();
const nameKey = async n => { const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('teacherhub|' + normName(n))); return Array.from(new Uint8Array(h)).slice(0, 12).map(x => x.toString(16).padStart(2, '0')).join(''); };
const pinCreds = async (name, pin) => { const k = await nameKey(name); return {email: 'n' + k + DOMAIN, password: 'th-pin:' + pin + ':' + k}; };
App.isCodeAccount = () => (S.email || '').endsWith(DOMAIN);
App.changePin = async (pin) => { const k = (S.email || '').slice(1, -DOMAIN.length); const {error} = await Store.sb.auth.updateUser({password: 'th-pin:' + pin + ':' + k}); if (error) throw error; };
let pendingName = '';
const errBox = m => `<div style="padding:10px 12px;border-radius:10px;background:color-mix(in srgb,var(--danger) 12%,var(--surface));color:var(--danger);margin-bottom:14px;font-size:14px">${esc(m)}</div>`;
const pinInput = (id, label) => `<label class="f" style="margin-top:12px"><span>${label}</span><input id="${id}" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" required autocomplete="off" placeholder="••••" style="text-align:center;letter-spacing:.5em;font-size:22px;font-weight:700"></label>`;
function showAuth(mode='name', msg='', prefill='') {
  let body = '';
  if (mode === 'name') body = `<h2>أهلًا بكِ</h2><p class="muted small" style="margin-top:0">اكتبي اسمك ورقمك السري. أول مرة؟ اختاري أي 4 أرقام تتذكرينها، وبها تدخلين بعدين من أي جهاز.</p><form id="af"><label class="f"><span>اسمك</span><input id="an" required maxlength="80" autocomplete="username" placeholder="مثال: نورة العتيبي" value="${esc(prefill)}"></label>${pinInput('apn', 'الرقم السري (4 أرقام)')}<button class="btn primary" style="width:100%;margin-top:16px">دخول</button></form><div style="text-align:center;margin-top:14px"><button class="btn ghost sm" data-m="login" style="font-size:13px;color:var(--muted)">دخول المطور</button></div>`;
  else if (mode === 'forgot') body = `<h2>استعادة كلمة المرور</h2><form id="af"><label class="f"><span>البريد الإلكتروني</span><input type="email" id="ae" dir="ltr" required autocomplete="email"></label><button class="btn primary" style="width:100%;margin-top:16px">إرسال الرابط</button></form><button class="btn ghost" data-m="login" style="width:100%;margin-top:8px">رجوع</button>`;
  else if (mode === 'reset') body = `<h2>كلمة مرور جديدة</h2><form id="af"><label class="f"><span>كلمة المرور الجديدة</span><input type="password" id="ap" minlength="8" required autocomplete="new-password"></label><button class="btn primary" style="width:100%;margin-top:16px">حفظ كلمة المرور</button></form>`;
  else body = `<h2>دخول المطور</h2><div class="seg" style="width:100%;margin-bottom:14px"><button data-m="login" class="${mode === 'login' ? 'on' : ''}" style="flex:1;justify-content:center">دخول</button><button data-m="signup" class="${mode === 'signup' ? 'on' : ''}" style="flex:1;justify-content:center">إنشاء حساب المطور</button></div><form id="af"><label class="f"><span>البريد الإلكتروني</span><input type="email" id="ae" dir="ltr" required autocomplete="email"></label><label class="f" style="margin-top:12px"><span>كلمة المرور</span><input type="password" id="ap" minlength="${mode === 'signup' ? 8 : 1}" required autocomplete="${mode === 'signup' ? 'new-password' : 'current-password'}"></label><button class="btn primary" style="width:100%;margin-top:16px">${mode === 'signup' ? 'إنشاء الحساب' : 'دخول'}</button></form>${mode === 'login' ? '<button class="btn ghost" data-m="forgot" style="width:100%;margin-top:8px">نسيت كلمة المرور؟</button>' : ''}<button class="btn ghost" data-m="name" style="width:100%;margin-top:4px">رجوع لدخول المعلمات</button>`;
  authShell(`<div id="amsg">${msg ? `<div style="padding:10px 12px;border-radius:10px;background:var(--accent-soft);margin-bottom:14px;font-size:14px">${esc(msg)}</div>` : ''}</div>${body}`);
  view.querySelectorAll('[data-m]').forEach(b => b.onclick = () => showAuth(b.dataset.m));
  const f = $('#af'); if (!f) return;
  const first = f.querySelector('input'); if (first) setTimeout(() => first.focus(), 50);
  f.onsubmit = async e => {
    e.preventDefault(); const btn = $('button', f); btn.disabled = true; const old = btn.textContent; btn.textContent = 'لحظة…';
    const val = id => ($('#' + id) ? $('#' + id).value.trim() : '');
    try {
      let r;
      if (mode === 'name') {
        const name = val('an').replace(/\s+/g, ' '); const pin = val('apn');
        if (name.length < 2) throw new Error('اكتبي اسمك');
        if (!/^\d{4}$/.test(pin)) throw new Error('الرقم السري 4 أرقام');
        const c = await pinCreds(name, pin);
        r = await Store.sb.auth.signInWithPassword(c);
        if (r.error && /Invalid login/i.test(r.error.message)) {
          // not found or wrong PIN: try to create the account
          const ok = await App.confirm(`ما لقينا حساب باسم «${name}» بهذا الرقم السري. هل هذه أول مرة تدخلين؟ سننشئ لك حسابًا جديدًا، وتدخلين بعدها بنفس الاسم والرقم.`, 'نعم، أول مرة', false);
          if (!ok) throw new Error('تأكدي من كتابة اسمك بنفس الطريقة أول مرة، ومن الرقم السري.');
          r = await Store.sb.auth.signUp(c);
          if (r.error && /already registered|already exists/i.test(r.error.message)) throw new Error('هذا الاسم مسجّل من قبل برقم سري مختلف. تأكدي من الرقم، أو أضيفي اسم العائلة إن كانت معلمة أخرى بنفس الاسم.');
          if (!r.error && !r.data.session) throw new Error('setup:confirm');
          if (!r.error) pendingName = name;
        }
      } else if (mode === 'login') r = await Store.sb.auth.signInWithPassword({email: val('ae'), password: $('#ap').value});
      else if (mode === 'signup') { r = await Store.sb.auth.signUp({email: val('ae'), password: $('#ap').value, options: {emailRedirectTo: location.origin + location.pathname}}); if (!r.error && !r.data.session) { showAuth('login', 'أنشأنا حسابك. افتحي رسالة التأكيد في بريدك ثم سجّلي الدخول.'); return; } }
      else if (mode === 'forgot') { r = await Store.sb.auth.resetPasswordForEmail(val('ae'), {redirectTo: location.origin + location.pathname}); if (!r.error) { showAuth('login', 'إن كان البريد مسجّلًا ستصلك رسالة فيها رابط تعيين كلمة المرور.'); return; } }
      else if (mode === 'reset') { r = await Store.sb.auth.updateUser({password: $('#ap').value}); if (!r.error) { App.toast('تم تغيير كلمة المرور'); location.hash = ''; enter(r.data.user); return; } }
      if (r.error) throw r.error;
    } catch(err) {
      const m = err.message || String(err);
      $('#amsg').innerHTML = errBox(m === 'setup:confirm' ? 'الموقع يحتاج إعدادًا من المطور: يجب إيقاف خيار «Confirm email» في Supabase (راجعي دليل النشر، الخطوة 5).' : /^[؀-ۿ]/.test(m) ? m : errAr(m));
    }
    finally { btn.disabled = false; btn.textContent = old; }
  };
}
App.signOut = async () => { if (!(await App.confirm('تسجيل الخروج من هذا الجهاز؟', 'خروج', false))) return; try { await Store.sb.auth.signOut(); } catch(e) {} try { localStorage.removeItem('teacherhub:theme'); } catch(e) {} location.hash = ''; location.reload(); };

/* ---------- Start ---------- */
let entered = false;
async function start() {
  try { const c = JSON.parse(localStorage.getItem('teacherhub:config') || 'null'); if (c) S.config = Object.assign({}, App.K.CONFIG, c); } catch(e) {}
  if (!configured) { Store.mode = 'local'; S.isOwner = true; return go(); }
  Store.sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {auth: {persistSession: true, autoRefreshToken: true, detectSessionInUrl: true}});
  Store.mode = 'cloud';
  loadConfig();
  Store.sb.auth.onAuthStateChange((ev, session) => {
    if (ev === 'PASSWORD_RECOVERY') { showAuth('reset'); return; }
    if (ev === 'SIGNED_IN' && session && !entered) enter(session.user);
    if (ev === 'SIGNED_OUT' && entered) location.reload();
  });
  const {data} = await Store.sb.auth.getSession();
  if (/type=recovery/.test(location.hash)) return; // handled by PASSWORD_RECOVERY
  if (data.session) enter(data.session.user); else showAuth('name');
}
async function loadConfig() {
  try { const {data} = await Store.sb.from('config').select('data').eq('id', 1).maybeSingle(); if (data) { S.config = Object.assign({}, App.K.CONFIG, data.data || {}); try { localStorage.setItem('teacherhub:config', JSON.stringify(S.config)); } catch(e) {} App.applyTheme(); App.banner(); App.flush(); } } catch(e) {}
}
async function enter(user) {
  if (entered) return; entered = true;
  app.classList.remove('auth'); S.uid = user.id; S.email = user.email || '';
  view.innerHTML = `<div class="loader"><div class="spin"></div><span>جارٍ تحميل بياناتك…</span></div>`;
  try { const {data} = await Store.sb.rpc('is_admin'); S.isOwner = !!data; } catch(e) {}
  try { await Store.loadAll(); }
  catch(e) { console.error(e); view.innerHTML = `<div class="onb card">${App.empty('alert', 'تعذّر تحميل بياناتك', 'تحققي من الاتصال بالإنترنت ثم أعيدي المحاولة.', '<button class="btn primary" onclick="location.reload()">إعادة المحاولة</button>')}</div>`; return; }
  Store.live();
  go();
}

function go() {
  App.banner();
  const names = ['tasks','events','links','lfolders','schedules','plans','notes','files','ffolders'];
  names.forEach(n => Store.watch(n, list => { S[n] = list; S.loaded[n] = true; App.flush(); }));
  if (Store.mode === 'local') Store.watch('chunks', list => { S.chunks = list; });
  Store.watch('meta', list => {
    const m = Object.fromEntries(list.map(d => [d.id, d]));
    S.profile = m.profile || null; S.quick = m.quick || {text:''}; S.notifs = m.notifs || {items:[]};
    S.loaded.meta = true; App.applyTheme(); ready();
  });
  App.loadRegistry = async () => {
    if (Store.mode !== 'cloud' || !S.isOwner) { App.registry = App.registry || []; return; }
    const {data, error} = await Store.sb.from('profiles').select('*').order('last_active', {ascending: false}).limit(2000);
    if (error) { App.toast('تعذّر تحميل قائمة المستخدمين', true); return; }
    App.registry = data.map(r => Object.assign({}, r, {joined: r.joined ? Date.parse(r.joined) : 0, lastActive: r.last_active ? Date.parse(r.last_active) : 0}));
    App.flush();
  };
  App.registry = Store.mode === 'local' ? [] : null;
}

function ready() {
  if (!S.loaded.meta) return;
  if (!S.ready) {
    S.ready = true;
    setTimeout(() => App.updateRegistry(), 4000);
    setInterval(tick, 20000); setTimeout(tick, 2500);
    setInterval(() => { App.tickCountdowns(); const c = document.getElementById('clockT'); if (c) { const t = D.time12(D.hm(new Date())); if (c.textContent !== t) c.textContent = t; } }, 1000);
    let lastMin = new Date().getMinutes();
    setInterval(() => { const m = new Date().getMinutes(); if (m !== lastMin) { lastMin = m; if (['dashboard','schedules'].includes(App.route())) App.flush(); } }, 5000);
  }
  if ((!S.profile || !S.profile.name) && pendingName) { const n = pendingName; pendingName = ''; App.saveProfile({name: n, loginName: n, createdAt: Date.now()}).then(() => { App.toast('أهلًا ' + n.split(' ')[0] + '! تدخلين بعدين باسمك ورقمك السري'); }); return; }
  if (!S.profile || !S.profile.name) { App.chrome(); $('#pageTitle').textContent = 'إعداد الحساب'; if (!App._onb) { App._onb = true; App.onboarding(view); } return; }
  App._onb = false;
  App.render(true);
}

/* reminders: each item records which alerts it already raised for its current due time */
let ticking = false;
async function tick() {
  if (ticking || !S.profile) return; ticking = true;
  try {
    const now = Date.now();
    for (const t of S.tasks) {
      if (t.status === 'done' || !t.due) continue;
      const due = D.parse(t.due).getTime(); const al = t.al && t.al.k === t.due ? Object.assign({}, t.al) : {k: t.due};
      let ch = false;
      if (t.remind > 0 && !al.pre && now >= due - t.remind * 60000 && now < due) { al.pre = 1; ch = true; await App.notify({title:'اقترب موعد: ' + t.title, body:`${D.dur(due - now)} · ${D.fmtDT(t.due)}`, kind:'soon', ref:'task:' + t.id}, t.pri === 'high'); }
      if (!al.end && now >= due) { al.end = 1; ch = true; if (t.remind !== -1) await App.notify({title:'انتهى موعد المهمة: ' + t.title, body:'لم تُسجَّل كمكتملة بعد.', kind:'due', ref:'task:' + t.id}, true); }
      if (ch) { try { await Store.put('tasks', Object.assign({}, t, {al})); } catch(e) {} }
    }
    for (const e of S.events) {
      if (!e.date || e.remind === -1) continue;
      const k = e.date + 'T' + (e.start || '08:00'); const at = D.parse(k).getTime(); const al = e.al && e.al.k === k ? Object.assign({}, e.al) : {k};
      if (!al.pre && now >= at - (e.remind || 0) * 60000 && now < at + 3600000) { al.pre = 1; await App.notify({title:(App.K.EV[e.type] || 'موعد') + ': ' + e.title, body: D.fmtDT(k), kind:'event', ref:'event:' + e.id}, e.type === 'exam' || e.type === 'meet'); try { await Store.put('events', Object.assign({}, e, {al})); } catch(x) {} }
    }
    const cr = S.profile.classRemind;
    if (cr > 0 && App.schedInfo) {
      const info = App.schedInfo(); const nx = info && info.today.find(x => x.state === 'next');
      if (nx && nx.ms <= cr * 60000 && nx.ms > 0) { const key = D.ymd(new Date()) + '-' + nx.i; if (App._clsKey !== key && !(S.notifs.items || []).some(n => n.ck === key)) { App._clsKey = key; await App.notify({title:`الحصة ${nx.n} بعد ${Math.ceil(nx.ms / 60000)} دقيقة`, body:[nx.cell.subject, nx.cell.grade, nx.cell.section].filter(Boolean).join(' · '), kind:'class', ref:'schedules', ck:key}); } }
    }
  } catch(e) { console.warn('tick', e); }
  ticking = false;
}

/* PWA */
if ('serviceWorker' in navigator && location.protocol === 'https:') window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; App.canInstall = true; App.flush(); });
App.install = async () => { if (!deferredInstall) return false; deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; App.canInstall = false; App.flush(); return true; };

start();
})();
