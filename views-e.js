/* مركز إنجاز الطلاب: فصول المعلمة، ومهام وتمارين تفاعلية، وتصحيح ودرجات، ورسائل، وحوافز، وتقارير، وواجهة للطالب */
'use strict';
(function(){
const {$, $$, esc, ic, D, S, Store, rid, clone} = App;

/* ---------------- storage ---------------- */
const KEY = 'teacherhub:edu', KSTU = 'teacherhub:eduStu';
let DB;
function load() {
  try { DB = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch(e) { DB = null; }
  DB = Object.assign({classes: [], students: [], tasks: [], subs: [], msgs: []}, DB || {});
}
load();
let editVer = 0;
function save() {
  editVer++;
  if (CLOUD()) { if (ctx === 'teacher') scheduleSync(); App.flush(); if (stuEl) stuRender(); return; }
  try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch(e) {} App.flush(); if (stuEl) stuRender();
}
/* student session: plain id in the trial copy, {id, token} on the live site */
let curStu = null, curTok = null;
try { const v = localStorage.getItem(KSTU); if (v) { if (v[0] === '{') { const o = JSON.parse(v); curStu = o.id; curTok = o.token; } else curStu = v; } } catch(e) {}
const setStu = (id, tok) => { curStu = id || null; curTok = tok || null; stuLoaded = false; try { id ? localStorage.setItem(KSTU, tok ? JSON.stringify({id, token: tok}) : id) : localStorage.removeItem(KSTU); } catch(e) {} };

/* =====================================================================
   المزامنة مع قاعدة البيانات (الموقع الأصلي فقط)
   ===================================================================== */
const CLOUD = () => Store.mode === 'cloud' && !!Store.sb;
let ctx = 'teacher', TDB = null, snap = null, syncT = 0, syncing = false, cloudReady = false, stuLoaded = false, stuErr = '';
App._eduErr = '';
const emptyDB = () => ({classes: [], students: [], tasks: [], subs: [], msgs: [], seen: {}});
const COLLS = ['classes', 'students', 'tasks', 'msgs', 'subs'];
const TBL = {classes: 'edu_classes', students: 'edu_students', tasks: 'edu_tasks', msgs: 'edu_msgs', subs: 'edu_subs'};
const strip = (o, keys) => { const r = {}; Object.keys(o).forEach(k => { if (!keys.includes(k)) r[k] = o[k]; }); return r; };
const toRow = {
  classes: c => ({id: c.id, code: c.code, data: strip(c, ['id', 'code', 'students'])}),
  students: s => ({id: s.id, pin: s.pin, name_key: norm(s.name), data: strip(s, ['id', 'pin', 'seen', 'token'])}),
  tasks: t => ({id: t.id, cls: t.cls, data: strip(t, ['id', 'cls'])}),
  msgs: m => ({id: m.id, cls: m.cls, data: strip(m, ['id', 'cls'])}),
  subs: s => ({id: s.id, tid: s.tid, sid: s.sid, data: strip(s, ['id', 'tid', 'sid'])})
};
function snapOf(db) { const o = {members: {}}; COLLS.forEach(k => { o[k] = {}; db[k].forEach(x => { o[k][x.id] = JSON.stringify(toRow[k](x)); }); }); db.classes.forEach(c => (c.students || []).forEach(s => { o.members[c.id + '|' + s] = 1; })); return o; }
const isSetupErr = m => /schema cache|does not exist|PGRST20|Could not find the (table|function)|42P01|42883/i.test(m || '');
async function cloudLoad(poll) {
  if (!CLOUD() || !S.uid || ctx !== 'teacher' || syncing || syncT) return;
  const v0 = editVer;
  try {
    const q = (t, cols) => Store.sb.from(t).select(cols);
    const res = await Promise.all([q('edu_classes', 'id,code,data'), q('edu_students', 'id,pin,data'), q('edu_members', 'cls,sid'), q('edu_tasks', 'id,cls,data'), q('edu_msgs', 'id,cls,data'), q('edu_subs', 'id,tid,sid,data')]);
    const bad = res.find(r => r.error); if (bad) throw bad.error;
    if (ctx !== 'teacher' || syncing || syncT || editVer !== v0) return; /* something changed meanwhile: keep it, the next refresh brings the rest */
    const [c, st, mem, t, m, s] = res.map(r => r.data || []);
    const nd = {
      classes: c.map(r => Object.assign({}, r.data, {id: r.id, code: r.code, students: mem.filter(x => x.cls === r.id).map(x => x.sid)})),
      students: st.map(r => Object.assign({}, r.data, {id: r.id, pin: r.pin})),
      tasks: t.map(r => Object.assign({}, r.data, {id: r.id, cls: r.cls})),
      msgs: m.map(r => Object.assign({}, r.data, {id: r.id, cls: r.cls})),
      subs: s.map(r => Object.assign({}, r.data, {id: r.id, tid: r.tid, sid: r.sid})), seen: {}};
    const before = poll && cloudReady ? {subs: new Set(DB.subs.map(x => x.id)), mem: new Set(Object.keys((snap || {}).members || {}))} : null;
    DB = nd; snap = snapOf(DB); App._eduErr = ''; cloudReady = true;
    if (before) {
      DB.subs.filter(x => !before.subs.has(x.id)).forEach(x => { const tk = DB.tasks.find(y => y.id === x.tid); if (!tk) return; tNotify('سلّم «' + ((stuById(x.sid) || {}).name || '') + '» مهمة «' + tk.title + '»', ((clsById(tk.cls) || {}).name || '') + (x.graded ? ' · صُحّحت تلقائيًا: ' + fmt(got(x)) + ' من ' + fmt(total(tk)) : ' · تحتاج تصحيحك'), !x.graded); });
      Object.keys(snap.members).filter(k => !before.mem.has(k)).forEach(k => { const [cid, sid] = k.split('|'); tNotify('انضم «' + ((stuById(sid) || {}).name || '') + '» إلى فصل ' + ((clsById(cid) || {}).name || ''), 'عبر رمز الفصل'); });
    }
    rescore();
    App.flush();
  } catch (err) { console.error(err); if (poll && snap) return; /* keep working with the copy already on screen */ App._eduErr = isSetupErr((err && (err.message || err.code)) || '') ? 'setup' : 'net'; cloudReady = true; App.flush(); }
}
/* re-check automatic marks from the saved answers (the teacher's copy is the reference) */
function rescore() {
  let changed = false;
  DB.subs.forEach(x => { if (x.reviewed) return; const tk = DB.tasks.find(y => y.id === x.tid); if (!tk) return;
    const r = autoScore(tk, x.answers || {}); const sc = {}; const byTeacher = !!x.gradedAt; tk.qs.forEach(q => { sc[q.id] = manualQ(q) ? (byTeacher ? +((x.scores || {})[q.id] || 0) : 0) : r.scores[q.id]; });
    const graded = r.needs ? !!x.graded && byTeacher : true;
    if (JSON.stringify(sc) !== JSON.stringify(x.scores || {}) || graded !== !!x.graded) { x.scores = sc; x.graded = graded; changed = true; } });
  if (changed) { editVer++; scheduleSync(); }
}
function scheduleSync() { clearTimeout(syncT); syncT = setTimeout(doSync, 250); }
async function doSync() {
  syncT = 0; if (!CLOUD() || !snap || ctx !== 'teacher') return;
  if (syncing) { syncT = setTimeout(doSync, 300); return; }
  syncing = true; const now = snapOf(DB), sb = Store.sb;
  const chk = r => { if (r.error) throw r.error; };
  try {
    for (const k of ['classes', 'students', 'tasks', 'msgs']) {
      const up = Object.keys(now[k]).filter(id => now[k][id] !== snap[k][id]).map(id => JSON.parse(now[k][id]));
      if (up.length) chk(await sb.from(TBL[k]).upsert(up));
    }
    const addM = Object.keys(now.members).filter(x => !snap.members[x]).map(x => { const [cls, sid] = x.split('|'); return {cls, sid}; });
    if (addM.length) chk(await sb.from('edu_members').upsert(addM));
    for (const id of Object.keys(now.subs)) if (snap.subs[id] && now.subs[id] !== snap.subs[id]) chk(await sb.from('edu_subs').update({data: JSON.parse(now.subs[id]).data}).eq('id', id));
    for (const x of Object.keys(snap.members).filter(x => !now.members[x])) { const [cls, sid] = x.split('|'); chk(await sb.from('edu_members').delete().match({cls, sid})); }
    for (const k of ['subs', 'msgs', 'tasks', 'students', 'classes']) { const del = Object.keys(snap[k]).filter(id => !now[k][id]); if (del.length) chk(await sb.from(TBL[k]).delete().in('id', del)); }
    snap = now; syncing = false;
  } catch (err) {
    console.error(err); syncing = false; snap = null;
    App.toast(isSetupErr(err && err.message) ? 'لم يُفعَّل «فصولي» في قاعدة البيانات بعد.' : 'تعذّر حفظ آخر تعديل في «فصولي». تحقّقي من الاتصال وأعيدي المحاولة.', true);
    cloudLoad();
  }
}
App._eduState = () => ({ctx, cloudReady, syncing, syncT: !!syncT, snap: !!snap, subs: DB.subs.length, err: App._eduErr});
App._eduReload = () => cloudLoad(true);
function useStudentDB() { if (CLOUD() && ctx !== 'student') { if (syncT) { clearTimeout(syncT); doSync(); } TDB = DB; ctx = 'student'; DB = emptyDB(); stuLoaded = false; } }
function useTeacherDB() { if (CLOUD() && ctx === 'student') { DB = TDB || emptyDB(); TDB = null; ctx = 'teacher'; } }
/* student calls (security-definer functions in the database) */
async function rpc(fn, args) { const {data, error} = await Store.sb.rpc(fn, args); if (error) throw error; if (data && data.error) { const er = new Error(data.error); er.code = data.error; throw er; } return data; }
const ERR = {name: 'اكتب اسمك الأول واسم الأب على الأقل', pin: 'الرقم السري 4 أرقام', phone: 'جوال ولي الأمر يبدأ بـ 05 ويتكوّن من 10 أرقام', exists: 'يوجد حساب بهذا الاسم والرقم السري. اختر «لدي حساب».', bad: 'الاسم أو الرقم السري غير صحيح', locked: 'محاولات خاطئة كثيرة. انتظر 10 دقائق ثم حاول مرة أخرى.', no_class: 'لا يوجد فصل بهذا الرمز. تأكد من الرمز وأعد المحاولة.', no_task: 'هذه المهمة غير متاحة الآن.', already: 'سلّمت هذه المهمة من قبل.'};
const errText = er => ERR[er && er.code] || (/edu:auth/.test((er && er.message) || '') ? 'انتهت جلستك، سجّل الدخول من جديد.' : isSetupErr(er && er.message) ? 'موقع الطلاب غير مفعّل بعد. أخبر معلمتك.' : 'تعذّر الاتصال. تحقّق من الإنترنت وأعد المحاولة.');
async function stuRefresh() {
  if (!CLOUD() || !curStu || !curTok) return;
  try {
    const d = await rpc('edu_stu_state', {p_id: curStu, p_token: curTok});
    if (ctx !== 'student') return;
    const me = strip(d.me, ['token']);
    DB = {students: [me], classes: (d.classes || []).map(c => Object.assign({}, c, {students: [me.id]})), tasks: d.tasks || [], subs: d.subs || [], msgs: d.msgs || [], seen: {[me.id]: +d.me.seen || 0}};
    stuLoaded = true; stuErr = '';
  } catch (er) { if (/edu:auth/.test((er && er.message) || '')) { setStu(null); App.toast(errText(er), true); } else { stuErr = errText(er); stuLoaded = true; } }
  if (stuEl) stuRender();
}
setInterval(() => { if (!CLOUD() || App.anyModal()) return; if (stuEl && curStu) stuRefresh(); else if (ctx === 'teacher' && S.uid && cloudReady && document.visibilityState === 'visible') cloudLoad(true); }, 30000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && CLOUD() && !App.anyModal()) { if (stuEl && curStu) stuRefresh(); else if (S.uid && cloudReady) cloudLoad(true); } });
const startCloud = setInterval(() => { if (!Store.mode || Store.mode === 'none') return; if (!CLOUD()) { clearInterval(startCloud); return; } if (S.ready && S.uid) { clearInterval(startCloud); cloudLoad(); } }, 400);

/* ---------------- helpers ---------------- */
const norm = s => String(s == null ? '' : s).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[.,،؛:!?؟"'«»()]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const toEn = s => String(s || '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
const phoneOf = s => { let d = toEn(s).replace(/\D/g, ''); if (/^9665\d{8}$/.test(d)) d = '0' + d.slice(3); if (/^5\d{8}$/.test(d)) d = '0' + d; return d; };
const okPhone = p => /^05\d{8}$/.test(p);
const waLink = p => 'https://wa.me/966' + p.slice(1);
const newCode = () => { const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; let c; do { c = Array.from({length: 6}, () => A[Math.floor(Math.random() * A.length)]).join(''); } while (DB.classes.some(x => x.code === c)); return c; };
const clsById = id => DB.classes.find(c => c.id === id);
const stuById = id => DB.students.find(s => s.id === id);
const tasksOf = cid => DB.tasks.filter(t => t.cls === cid).sort((a, b) => (b.at || 0) - (a.at || 0));
const subOf = (tid, sid) => DB.subs.find(s => s.tid === tid && s.sid === sid);
const studentsOf = c => (c.students || []).map(stuById).filter(Boolean);
const total = t => (t.qs || []).reduce((n, q) => n + (+q.pts || 0), 0);
const got = s => Object.values(s.scores || {}).reduce((n, v) => n + (+v || 0), 0);
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
const fmt = n => String(Math.round((+n || 0) * 100) / 100);
const when = ts => D.short(new Date(ts));
const isTrial = () => Store.mode === 'local' || !((window.TEACHER_HUB_CONFIG || {}).SUPABASE_URL);
const inviteUrl = c => location.origin + location.pathname + '#join-' + c.code;
const copy = async t => { try { await navigator.clipboard.writeText(t); App.toast('تم النسخ'); } catch(e) { App.toast('تعذّر النسخ، انسخيه يدويًا: ' + t, true); } };

const QT = {mcq: 'اختيار من متعدد', tf: 'صح أو خطأ', short: 'إجابة قصيرة', essay: 'سؤال مقالي', match: 'توصيل', order: 'ترتيب كلمات الجملة', link: 'نشاط تفاعلي برابط'};
const QI = {mcq: 'list', tf: 'check', short: 'edit', essay: 'note', match: 'link', order: 'sliders', link: 'game'};

const kwList = q => String(q.kw || '').split(/[\n،,]+/).map(s => s.trim()).filter(Boolean);
/* auto-correction: returns {scores, needs} — needs=true when a question waits for the teacher */
function autoScore(t, ans) {
  const scores = {}; let needs = false;
  (t.qs || []).forEach(q => {
    const a = ans[q.id], P = +q.pts || 0;
    if (q.type === 'mcq' || q.type === 'tf') scores[q.id] = a != null && String(a) === String(q.answer) ? P : 0;
    else if (q.type === 'short') { if (q.answer) scores[q.id] = String(q.answer).split('|').some(x => norm(x) && norm(x) === norm(a)) ? P : 0; else { scores[q.id] = 0; needs = true; } }
    else if (q.type === 'essay') { const keys = kwList(q); if (keys.length) { const t2 = norm(a); const ok = keys.filter(k => t2.includes(norm(k))).length; scores[q.id] = Math.round(ok / keys.length * P * 100) / 100; } else { scores[q.id] = 0; needs = true; } }
    else if (q.type === 'match') { const ok = (q.pairs || []).filter((p, i) => a && a[i] === p.b).length; scores[q.id] = (q.pairs || []).length ? Math.round(ok / q.pairs.length * P * 100) / 100 : 0; }
    else if (q.type === 'order') scores[q.id] = norm(a) && norm(a) === norm(q.sentence) ? P : 0;
    else if (q.type === 'link') scores[q.id] = a ? P : 0;
  });
  return {scores, needs};
}
function studentStats(c, sid) {
  const ts = tasksOf(c.id).filter(t => t.pub);
  let done = 0, a = 0, b = 0, wait = 0;
  ts.forEach(t => { const s = subOf(t.id, sid); if (!s) return; done++; if (s.graded) { a += got(s); b += total(t); } else wait++; });
  return {tasks: ts.length, done, wait, avg: b ? pct(a, b) : null};
}

/* ---------------- ready-made exercise library ---------------- */
const LIB = [
  {sub: 'التوحيد', title: 'الأصول الثلاثة', note: 'من ربك؟ ما دينك؟ من نبيك؟', qs: [{type: 'mcq', text: 'من ربك؟', pts: 1, options: ['ربي الله', 'لا أعرف', 'الشمس', 'القمر'], answer: 0}, {type: 'mcq', text: 'ما دينك؟', pts: 1, options: ['ديني الإسلام', 'لا دين لي', 'دين آبائي فقط', 'لا أدري'], answer: 0}, {type: 'mcq', text: 'من نبيك؟', pts: 1, options: ['نبيي محمد ﷺ', 'نبيي موسى عليه السلام', 'لا أعرف', 'نبيي عيسى عليه السلام'], answer: 0}, {type: 'short', text: 'أكمل: الأصول الثلاثة هي معرفة العبد ربه، ودينه، و…', pts: 1, answer: 'نبيه|نبيه محمد|نبيه محمدا'}]},
  {sub: 'التوحيد', title: 'أركان الإسلام', note: 'توصيل كل ركن بترتيبه', qs: [{type: 'match', text: 'صِل كل ركن من أركان الإسلام بترتيبه.', pts: 5, pairs: [{a: 'الركن الأول', b: 'الشهادتان'}, {a: 'الركن الثاني', b: 'إقام الصلاة'}, {a: 'الركن الثالث', b: 'إيتاء الزكاة'}, {a: 'الركن الرابع', b: 'صوم رمضان'}, {a: 'الركن الخامس', b: 'حج البيت'}]}, {type: 'tf', text: 'عدد أركان الإسلام خمسة.', pts: 1, answer: 'true'}]},
  {sub: 'التوحيد', title: 'أنواع التوحيد', note: 'توصيل واختيار وكتابة', qs: [{type: 'match', text: 'صِل كل نوع من أنواع التوحيد بمعناه.', pts: 3, pairs: [{a: 'توحيد الربوبية', b: 'إفراد الله بأفعاله كالخلق والرزق'}, {a: 'توحيد الألوهية', b: 'إفراد الله بالعبادة'}, {a: 'توحيد الأسماء والصفات', b: 'إثبات ما أثبته الله لنفسه من الأسماء والصفات'}]}, {type: 'tf', text: 'الدعاء عبادة لا تُصرف إلا لله تعالى.', pts: 1, answer: 'true'}, {type: 'order', text: 'رتّب الكلمات لتكوين كلمة التوحيد.', pts: 2, sentence: 'لا إله إلا الله'}]},
  {sub: 'التوحيد', title: 'معنى العبادة', note: 'صح أو خطأ واختيار', qs: [{type: 'tf', text: 'الصلاة من العبادات.', pts: 1, answer: 'true'}, {type: 'tf', text: 'يجوز أن نطلب الشفاء من غير الله.', pts: 1, answer: 'false'}, {type: 'mcq', text: 'خلقنا الله تعالى من أجل:', pts: 1, options: ['عبادته وحده', 'اللعب فقط', 'النوم', 'الأكل والشرب'], answer: 0}, {type: 'essay', text: 'اذكر عبادة تحب أن تؤديها كل يوم، ولماذا؟', pts: 2}]},
  {sub: 'لغتي', title: 'معاني الكلمات', note: 'توصيل الكلمة بمعناها', qs: [{type: 'match', text: 'صِل كل كلمة بمعناها.', pts: 4, pairs: [{a: 'الغيث', b: 'المطر'}, {a: 'الفؤاد', b: 'القلب'}, {a: 'البأس', b: 'القوة'}, {a: 'الوجل', b: 'الخوف'}]}]},
  {sub: 'لغتي', title: 'أبني جملة', note: 'ترتيب الكلمات لتكوين جمل صحيحة', qs: [{type: 'order', text: 'رتّب الكلمات لتكوين جملة صحيحة.', pts: 2, sentence: 'يحافظ المسلم على نظافة المكان'}, {type: 'order', text: 'رتّب الكلمات لتكوين جملة صحيحة.', pts: 2, sentence: 'قرأت قصة جميلة في المكتبة'}]},
  {sub: 'لغتي', title: 'الفهم القرائي: النخلة', note: 'نص قصير وأسئلة', desc: 'اقرأ النص ثم أجب: النخلة شجرة مباركة، يأكل الناس من ثمرها، ويصنعون من سعفها السلال، ويستظلون بظلها في الصيف.', qs: [{type: 'mcq', text: 'يصنع الناس من سعف النخلة:', pts: 1, options: ['السلال', 'الأبواب', 'الملابس', 'الأحذية'], answer: 0}, {type: 'tf', text: 'النخلة شجرة مباركة.', pts: 1, answer: 'true'}, {type: 'short', text: 'متى يستظل الناس بظل النخلة؟', pts: 1, answer: 'في الصيف|الصيف'}, {type: 'essay', text: 'اكتب فائدة أخرى للنخلة لم تُذكر في النص.', pts: 2}]},
  {sub: 'لغتي', title: 'التاء المربوطة والمفتوحة', note: 'اختيار وتصنيف', qs: [{type: 'mcq', text: 'الكلمة المنتهية بتاء مربوطة هي:', pts: 1, options: ['مدرسة', 'بيت', 'صوت', 'نبات'], answer: 0}, {type: 'mcq', text: 'الكلمة المنتهية بتاء مفتوحة هي:', pts: 1, options: ['شجرة', 'زهرة', 'بنت', 'سيارة'], answer: 2}, {type: 'tf', text: 'كلمة «قطة» تنتهي بتاء مربوطة.', pts: 1, answer: 'true'}]}
];

/* =====================================================================
   واجهة المعلمة
   ===================================================================== */
App.ui.ach = {cls: null, tab: 'tasks'};

function editClass(c) {
  const v = c ? clone(c) : {name: '', subject: (S.profile || {}).subject || '', grade: ''};
  App.modal({title: c ? 'إعدادات الفصل' : 'فصل جديد', body: `<div class="fgrid">
    <label class="f"><span>اسم الفصل *</span><input id="xn" value="${esc(v.name)}" placeholder="مثال: الثالث أ"></label>
    <label class="f"><span>المادة</span><input id="xs" value="${esc(v.subject || '')}" placeholder="مثال: لغتي"></label>
    <label class="f full"><span>الصف</span><input id="xg" value="${esc(v.grade || '')}" placeholder="مثال: الثالث الابتدائي"></label></div>
    ${c ? `<p class="small muted" style="margin-bottom:0">رمز الفصل: <b dir="ltr">${esc(c.code)}</b></p>` : ''}`,
  foot: [{label: 'حفظ', cls: 'primary', icon: 'check', onClick(api) {
    const name = App.val(api.el, '#xn'); if (!name) { App.toast('اكتبي اسم الفصل', true); return false; }
    if (c) Object.assign(clsById(c.id), {name, subject: App.val(api.el, '#xs'), grade: App.val(api.el, '#xg')});
    else { const n = {id: rid(), name, subject: App.val(api.el, '#xs'), grade: App.val(api.el, '#xg'), code: newCode(), students: [], at: Date.now(), teacher: (S.profile || {}).name || '', school: (S.profile || {}).school || ''}; DB.classes.push(n); App.ui.ach.cls = n.id; }
    save(); App.toast(c ? 'تم حفظ الفصل' : 'تم إنشاء الفصل، وأصبح له رمز دعوة');
  }}, '|', ...(c ? [{label: 'رمز جديد', cls: 'ghost', icon: 'spark', async onClick() { if (!(await App.confirm('إنشاء رمز جديد؟ الرمز القديم لن يعمل بعد ذلك، والطلاب المنضمون يبقون في الفصل.', 'إنشاء', false))) return false; clsById(c.id).code = newCode(); save(); App.toast('تم إنشاء رمز جديد'); }},
    {label: 'حذف الفصل', cls: 'ghost danger', icon: 'trash', async onClick() {
      if (!(await App.confirm('حذف الفصل «' + c.name + '» مع جميع مهامه ودرجاته ورسائله؟ لا يمكن التراجع.'))) return false;
      const tids = DB.tasks.filter(t => t.cls === c.id).map(t => t.id);
      DB.subs = DB.subs.filter(s => !tids.includes(s.tid)); DB.tasks = DB.tasks.filter(t => t.cls !== c.id); DB.msgs = DB.msgs.filter(m => m.cls !== c.id); DB.classes = DB.classes.filter(x => x.id !== c.id);
      App.ui.ach.cls = null; save(); App.toast('تم حذف الفصل');
    }}] : [])]});
}

function inviteModal(c) {
  const url = inviteUrl(c);
  const msg = `السلام عليكم، للانضمام إلى فصل «${c.name}» في مركز إنجاز الطلاب:\n1) افتح الرابط: ${url}\n2) أنشئ حساب طالب باسمك.\nأو اكتب رمز الفصل: ${c.code}`;
  App.modal({title: 'دعوة الطلاب إلى ' + c.name, body: `<div class="ach-code big" dir="ltr">${esc(c.code)}</div>
    <p class="small muted" style="text-align:center;margin-top:6px">ينشئ الطالب حسابه، ثم يفتح الرابط أو يكتب هذا الرمز، فينضم إلى فصلك.</p>
    <div class="row" style="gap:8px;flex-wrap:wrap;justify-content:center;margin:14px 0">
      <button class="btn" data-c="code">${ic('copy')}نسخ الرمز</button><button class="btn" data-c="link">${ic('link')}نسخ الرابط</button>
      <a class="btn" href="https://wa.me/?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">${ic('globe')}مشاركة عبر واتساب</a></div>
    ${isTrial() ? `<div class="bn" style="border-radius:var(--r-s)">${ic('info')}<span>في النسخة التجريبية لا يصل الرابط إلى أجهزة أخرى. جرّبي تجربة الطالب بنفسك من الزر أدناه.</span></div>` : ''}`,
    onMount(m) { $('[data-c=code]', m).onclick = () => copy(c.code); $('[data-c=link]', m).onclick = () => copy(url); },
    foot: [{label: 'تجربة الدعوة كطالب', cls: 'primary', icon: 'user', onClick() { openStudent(c.code); }}]});
}

/* ---------- task editor ---------- */
function qDefaults(type) {
  const b = {id: rid(), type, text: '', pts: 1};
  if (type === 'mcq') Object.assign(b, {options: ['', '', '', ''], answer: 0});
  if (type === 'tf') b.answer = 'true';
  if (type === 'short') b.answer = '';
  if (type === 'essay') b.pts = 2;
  if (type === 'match') Object.assign(b, {text: 'صِل كل كلمة بمعناها.', pairs: [{a: '', b: ''}, {a: '', b: ''}, {a: '', b: ''}], pts: 3});
  if (type === 'order') Object.assign(b, {text: 'رتّب الكلمات لتكوين جملة صحيحة.', sentence: '', pts: 2});
  if (type === 'link') Object.assign(b, {text: '', url: '', pts: 2});
  return b;
}
const LET = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];
function qCard(q, i) {
  let f = '';
  if (q.type === 'mcq') f = `<div class="qe-l">الخيارات <small>— اضغطي «صحيحة» بجانب الإجابة الصحيحة</small></div><div class="qe-opts">${q.options.map((o, k) => `<div class="qe-opt ${+q.answer === k ? 'ok' : ''}"><span class="qe-let">${LET[k]}</span><input type="text" data-o="${k}" value="${esc(o)}" placeholder="الخيار ${LET[k]}"><button type="button" class="qe-okbtn" data-ok="${k}">${ic('check')}${+q.answer === k ? 'الإجابة الصحيحة' : 'صحيحة؟'}</button>${q.options.length > 2 ? `<button type="button" class="icon-btn sm" data-rmo="${k}" aria-label="حذف الخيار">${ic('x')}</button>` : ''}</div>`).join('')}</div>${q.options.length < 6 ? `<button type="button" class="btn sm ghost" data-addo>${ic('plus')}خيار آخر</button>` : ''}`;
  if (q.type === 'tf') f = `<div class="qe-l">الإجابة الصحيحة</div><div class="qe-tf"><button type="button" data-tf="true" class="${q.answer === 'true' ? 'on' : ''}">${ic('check')}صح</button><button type="button" data-tf="false" class="${q.answer === 'false' ? 'on' : ''}">${ic('x')}خطأ</button></div>`;
  if (q.type === 'short') { const parts = String(q.answer || '').split('|'); f = `<div class="qe-l">الإجابة الصحيحة</div><input type="text" data-k="a0" value="${esc(parts[0] || '')}" placeholder="مثال: في الصيف"><div class="qe-l">إجابات أخرى مقبولة <small>(اختياري، كل إجابة في سطر)</small></div><textarea data-k="alts" rows="2" placeholder="مثال: الصيف">${esc(parts.slice(1).join('\n'))}</textarea><div class="qe-note">${ic('info')}<span>تُصحَّح تلقائيًا دون اعتبار للتشكيل والهمزات والتاء المربوطة. إن تركتِ الإجابة فارغة صحّحتِها بنفسك.</span></div>`; }
  if (q.type === 'essay') f = `<div class="qe-l">كلمات مفتاحية للتصحيح التلقائي <small>(اختياري، كلمة أو عبارة في كل سطر)</small></div><textarea data-k="kw" rows="3" placeholder="مثال:&#10;الأبواب&#10;السقوف&#10;الحطب">${esc(q.kw || '')}</textarea>
    <div class="qe-l">إجابة نموذجية <small>(اختياري، تظهر لكِ عند المراجعة فقط)</small></div><textarea data-k="model" rows="2">${esc(q.model || '')}</textarea>
    <div class="qe-note">${ic(String(q.kw || '').trim() ? 'check' : 'edit')}<span>${String(q.kw || '').trim() ? 'يُصحَّح تلقائيًا: تُوزَّع الدرجة على الكلمات المفتاحية، ويأخذ الطالب نصيب كل كلمة تظهر في إجابته. يمكنك مراجعة الدرجة وتعديلها.' : 'بدون كلمات مفتاحية تصحّحين هذا السؤال بنفسك، وتظهر الدرجة للطالب بعد اعتمادها.'}</span></div>`;
  if (q.type === 'match') f = `<div class="qe-l">الأزواج الصحيحة <small>— تظهر للطالب مخلوطة</small></div><div class="qe-pairs"><div class="qe-ph"><span>الكلمة</span><span></span><span>ما يقابلها (الصحيح)</span><span></span></div>${q.pairs.map((pr, k) => `<div class="qe-pair" data-p="${k}"><input type="text" data-a value="${esc(pr.a)}" placeholder="مثال: الغيث"><span class="arw">←</span><input type="text" data-b value="${esc(pr.b)}" placeholder="مثال: المطر"><button type="button" class="icon-btn sm" data-rmp="${k}" aria-label="حذف الزوج">${ic('x')}</button></div>`).join('')}</div><button type="button" class="btn sm ghost" data-addp>${ic('plus')}زوج جديد</button><div class="qe-note">${ic('info')}<span>الدرجة تُوزَّع بالتساوي على الأزواج: ${q.pairs.length ? fmt((+q.pts || 0) / q.pairs.length) : 0} لكل توصيل صحيح.</span></div>`;
  if (q.type === 'order') { const w = String(q.sentence || '').trim().split(/\s+/).filter(Boolean); f = `<div class="qe-l">الجملة الصحيحة</div><input type="text" data-k="sentence" value="${esc(q.sentence || '')}" placeholder="مثال: يحافظ المسلم على نظافة المكان">${w.length > 1 ? `<div class="qe-chips">${shuffle(w).map(x => `<span class="chip">${esc(x)}</span>`).join('')}</div>` : ''}<div class="qe-note">${ic('info')}<span>تُحسب الدرجة كاملة إذا رتّب الطالب الجملة كلها صحيحة.</span></div>`; }
  if (q.type === 'link') f = `<div class="qe-l">رابط النشاط</div><input type="text" data-k="url" dir="ltr" value="${esc(q.url || '')}" placeholder="https://…"><div class="qe-note">${ic('info')}<span>تُحتسب الدرجة كاملة عندما يؤكد الطالب أنه أنهى النشاط، ويمكنك تعديلها.</span></div>`;
  return `<div class="ach-q qe" data-i="${i}"><div class="qe-h"><span class="qe-n">${i + 1}</span><span class="qe-type">${ic(QI[q.type])}${QT[q.type]}</span><span class="grow"></span>
    <div class="qe-pts"><button type="button" data-pm="-1" aria-label="إنقاص الدرجة">−</button><input type="number" min="0" step="0.5" data-k="pts" value="${esc(q.pts)}" aria-label="الدرجة"><span>درجة</span><button type="button" data-pm="1" aria-label="زيادة الدرجة">+</button></div>
    <button type="button" class="icon-btn sm" data-up aria-label="تحريك لأعلى" ${i ? '' : 'disabled'}>${ic('up')}</button><button type="button" class="icon-btn sm" data-del aria-label="حذف السؤال">${ic('trash')}</button></div>
    <div class="qe-l">${q.type === 'link' ? 'اسم النشاط' : q.type === 'match' || q.type === 'order' ? 'التعليمات' : 'نص السؤال'}</div><input type="text" data-k="text" value="${esc(q.text)}" placeholder="${q.type === 'link' ? 'مثال: لعبة الحروف' : 'اكتبي السؤال هنا'}">${f}</div>`;
}
function readQs(m, qs) {
  $$('.qe', m).forEach(card => {
    const q = qs[+card.dataset.i]; if (!q) return;
    $$('[data-k]', card).forEach(inp => { const k = inp.dataset.k; if (k === 'pts') q.pts = Math.max(0, Math.round((+inp.value || 0) * 100) / 100); else if (k !== 'a0' && k !== 'alts') q[k] = inp.value; });
    if (q.type === 'short') q.answer = [$('[data-k=a0]', card).value].concat($('[data-k=alts]', card).value.split(/\n+/)).map(s => s.replace(/\|/g, ' ').trim()).filter(Boolean).join('|');
    if (q.type === 'mcq') q.options = $$('[data-o]', card).map(x => x.value);
    if (q.type === 'match') q.pairs = $$('.qe-pair', card).map(pr => ({a: $('[data-a]', pr).value, b: $('[data-b]', pr).value}));
  });
}
function editTask(c, t, preset) {
  const v = t ? clone(t) : Object.assign({title: '', desc: '', due: '', pub: true, qs: []}, preset ? clone(preset) : {});
  if (!t && preset) v.qs = v.qs.map(q => Object.assign({}, q, {id: rid()}));
  const qs = v.qs; const hasSubs = t && DB.subs.some(s => s.tid === t.id);
  App.modal({title: t ? 'تعديل المهمة' : 'مهمة جديدة — ' + c.name, wide: true, body: `
    <div class="qe-step"><span>1</span>بيانات المهمة</div><div class="fgrid">
    <label class="f"><span>عنوان المهمة *</span><input id="tt" value="${esc(v.title)}" placeholder="مثال: واجب الدرس الثالث"></label>
    <label class="f"><span>آخر موعد للتسليم</span><input type="date" id="td" value="${esc(v.due || '')}"></label>
    <label class="f full"><span>تعليمات أو نص للقراءة (اختياري)</span><textarea id="tx" rows="3" placeholder="اكتبي التعليمات أو النص الذي يقرؤه الطالب قبل الإجابة">${esc(v.desc || '')}</textarea></label></div>
    <div class="qe-step"><span>2</span>الأسئلة <small id="qsum"></small></div><div id="qs"></div>
    <div class="qe-add"><div class="qe-l">أضيفي سؤالًا:</div><div class="qe-addg">${Object.keys(QT).map(k => `<button type="button" data-add="${k}"><span>${ic(QI[k])}</span>${QT[k]}</button>`).join('')}</div></div>
    <div class="qe-step"><span>3</span>الإرسال</div>
    ${!t && DB.classes.length > 1 ? `<div class="f full"><span style="font-weight:600;color:var(--muted);font-size:14px">إرسال المهمة إلى</span><div class="ach-multi">${DB.classes.map(x => `<label class="chip"><input type="checkbox" data-tc="${esc(x.id)}" ${x.id === c.id ? 'checked' : ''}>${esc(x.name)}</label>`).join('')}</div></div>` : ''}
    <label class="item" style="margin-top:10px;cursor:pointer;align-items:center"><input type="checkbox" id="tp" ${v.pub ? 'checked' : ''}><span class="body"><span class="t">إرسال المهمة للطلاب الآن</span><span class="small muted" style="display:block">ألغي التحديد لحفظها مسودة لا يراها الطلاب.</span></span></label>
    ${hasSubs ? `<div class="qe-note warn">${ic('alert')}<span>سلّم بعض الطلاب هذه المهمة. عند الحفظ يُعاد تصحيح إجاباتهم تلقائيًا حسب التعديلات، وتبقى درجات الأسئلة المقالية كما صحّحتِها.</span></div>` : ''}`,
  onMount(m) {
    const sum = () => { readQs(m, qs); const tot = qs.reduce((n, q) => n + (+q.pts || 0), 0); $('#qsum', m).textContent = qs.length ? `· ${qs.length} ${qs.length > 2 ? 'أسئلة' : 'سؤال'} · مجموع الدرجات ${fmt(tot)}` : ''; };
    const draw = () => { $('#qs', m).innerHTML = qs.length ? qs.map(qCard).join('') : `<div class="qe-empty">${ic('plus')}<span>لم تُضف أسئلة بعد. اختاري نوع السؤال من الأزرار أدناه.</span></div>`; sum(); };
    draw();
    /* live hints without redrawing (keeps the cursor where the teacher is typing) */
    const live = card => { const q = qs[+card.dataset.i]; if (!q) return;
      if (q.type === 'match') { const sp = $('.qe-note span', card); if (sp) sp.textContent = 'الدرجة تُوزَّع بالتساوي على الأزواج: ' + (q.pairs.length ? fmt((+q.pts || 0) / q.pairs.length) : 0) + ' لكل توصيل صحيح.'; }
      if (q.type === 'order') { const w = String(q.sentence || '').trim().split(/\s+/).filter(Boolean); let box = $('.qe-chips', card); if (!box) { box = document.createElement('div'); box.className = 'qe-chips'; $('[data-k=sentence]', card).after(box); } box.innerHTML = w.length > 1 ? shuffle(w).map(x => `<span class="chip">${esc(x)}</span>`).join('') : ''; }
      if (q.type === 'essay') { const sp = $('.qe-note span', card); if (sp) sp.textContent = kwList(q).length ? 'يُصحَّح تلقائيًا: تُوزَّع الدرجة على ' + kwList(q).length + ' كلمات مفتاحية (' + fmt((+q.pts || 0) / kwList(q).length) + ' لكل كلمة تظهر في إجابة الطالب). يمكنك مراجعة الدرجة وتعديلها.' : 'بدون كلمات مفتاحية تصحّحين هذا السؤال بنفسك، وتظهر الدرجة للطالب بعد اعتمادها.'; }
    };
    m.addEventListener('input', e => { const card = e.target.closest('.qe'); if (card) { sum(); live(card); } });
    m.addEventListener('click', e => {
      const add = e.target.closest('[data-add]'); if (add) { readQs(m, qs); qs.push(qDefaults(add.dataset.add)); draw(); const last = $$('.qe', m).pop(); if (last) { last.scrollIntoView({block: 'center', behavior: 'smooth'}); const inp = $('[data-k=text]', last); setTimeout(() => { const ae = document.activeElement; if (!ae || !m.contains(ae) || ae.closest('[data-add]') || ae === document.body) inp.focus(); }, 250); } return; }
      const card = e.target.closest('.qe'); if (!card) return; const i = +card.dataset.i, q = qs[i]; const hit = s => e.target.closest(s);
      if (hit('[data-del]')) { readQs(m, qs); qs.splice(i, 1); draw(); }
      else if (hit('[data-up]')) { if (!i) return; readQs(m, qs); [qs[i - 1], qs[i]] = [qs[i], qs[i - 1]]; draw(); }
      else if (hit('[data-pm]')) { readQs(m, qs); q.pts = Math.max(0, (+q.pts || 0) + +hit('[data-pm]').dataset.pm); draw(); }
      else if (hit('[data-ok]')) { readQs(m, qs); q.answer = +hit('[data-ok]').dataset.ok; draw(); }
      else if (hit('[data-tf]')) { readQs(m, qs); q.answer = hit('[data-tf]').dataset.tf; draw(); }
      else if (hit('[data-addo]')) { readQs(m, qs); q.options.push(''); draw(); }
      else if (hit('[data-rmo]')) { readQs(m, qs); const k = +hit('[data-rmo]').dataset.rmo; q.options.splice(k, 1); if (q.answer === k) q.answer = 0; else if (q.answer > k) q.answer--; draw(); }
      else if (hit('[data-addp]')) { readQs(m, qs); q.pairs.push({a: '', b: ''}); draw(); }
      else if (hit('[data-rmp]')) { readQs(m, qs); q.pairs.splice(+hit('[data-rmp]').dataset.rmp, 1); draw(); }
    });
  },
  foot: [{label: 'معاينة كما يراها الطالب', icon: 'eye', close: false, onClick(api) { readQs(api.el, qs); if (!qs.length) { App.toast('أضيفي سؤالًا أولًا', true); return; } solve({title: App.val(api.el, '#tt') || 'معاينة', desc: App.val(api.el, '#tx'), qs: clone(qs)}, true); }}, '|',
    {label: t ? 'حفظ التعديلات' : 'حفظ المهمة', cls: 'primary', icon: 'check', onClick(api) {
    const m = api.el; readQs(m, qs);
    const title = App.val(m, '#tt'); if (!title) { App.toast('اكتبي عنوان المهمة', true); return false; }
    if (!qs.length) { App.toast('أضيفي سؤالًا واحدًا على الأقل', true); return false; }
    for (const [k, q] of qs.entries()) {
      const n = 'السؤال ' + (k + 1) + ': ';
      if (!(+q.pts > 0)) { App.toast(n + 'اكتبي درجة السؤال', true); return false; }
      if (q.type === 'mcq' && (q.options.filter(o => o.trim()).length < 2 || !String(q.options[q.answer] || '').trim())) { App.toast(n + 'اكتبي خيارين على الأقل، واضغطي «صحيحة» بجانب الإجابة الصحيحة', true); return false; }
      if (q.type === 'match') { q.pairs = q.pairs.filter(pr => pr.a.trim() && pr.b.trim()); if (q.pairs.length < 2) { App.toast(n + 'أضيفي زوجين على الأقل', true); return false; } if (new Set(q.pairs.map(pr => norm(pr.b))).size < q.pairs.length) { App.toast(n + 'لا تكرري الإجابة نفسها في التوصيل', true); return false; } }
      if (q.type === 'order' && String(q.sentence || '').trim().split(/\s+/).length < 2) { App.toast(n + 'اكتبي جملة من كلمتين أو أكثر', true); return false; }
      if (q.type === 'link' && !/^https?:\/\//i.test(String(q.url || '').trim())) { App.toast(n + 'اكتبي رابطًا صحيحًا يبدأ بـ https://', true); return false; }
      if (q.type !== 'link' && q.type !== 'match' && q.type !== 'order' && !String(q.text || '').trim()) { App.toast(n + 'اكتبي نص السؤال', true); return false; }
      if (q.type === 'mcq') { const keep = q.options.map((o, j) => [o.trim(), j]).filter(x => x[0]); q.answer = keep.findIndex(x => x[1] === q.answer); q.options = keep.map(x => x[0]); }
    }
    const data = {title, desc: App.val(m, '#tx'), due: $('#td', m).value, pub: $('#tp', m).checked, qs};
    if (t) {
      const tt = DB.tasks.find(x => x.id === t.id); Object.assign(tt, data);
      let n = 0; DB.subs.filter(s => s.tid === t.id).forEach(s => { const r = autoScore(tt, s.answers || {}); const sc = {}; tt.qs.forEach(q => { sc[q.id] = manualQ(q) ? Math.min(+q.pts, +((s.scores || {})[q.id] || 0)) : r.scores[q.id]; }); s.scores = sc; if (!r.needs) s.graded = true; n++; });
      save(); App.toast(n ? 'تم حفظ المهمة وأُعيد تصحيح ' + n + ' تسليمًا' : 'تم حفظ المهمة'); return;
    }
    const targets = $$('[data-tc]', m).length ? $$('[data-tc]:checked', m).map(x => x.dataset.tc) : [c.id];
    if (!targets.length) { App.toast('اختاري فصلًا واحدًا على الأقل', true); return false; }
    targets.forEach(cid => DB.tasks.push(Object.assign({id: rid(), cls: cid, at: Date.now()}, clone(data))));
    save(); App.toast(data.pub ? (targets.length > 1 ? 'أُرسلت المهمة إلى ' + targets.length + ' فصول' : 'أُرسلت المهمة لطلاب الفصل') : 'حُفظت المهمة مسودة');
  }}]});
}
function libModal(c) {
  const subs = [...new Set(LIB.map(x => x.sub))];
  App.modal({title: 'مكتبة التمارين', wide: true, body: `<p class="small muted" style="margin-top:0">اضغطي «تعيين» لفتح التمرين، ويمكنك تعديله قبل إرساله للطلاب.</p>${subs.map(sb => `<h4 class="ach-libh">${esc(sb)}</h4><div class="ach-lib">${LIB.map((x, i) => x.sub !== sb ? '' : `<div class="ach-libc"><div class="ach-libi">${ic(QI[x.qs[0].type])}</div><b>${esc(x.title)}</b><span class="small muted">${esc(x.note)} · ${x.qs.length} ${x.qs.length > 2 ? 'أسئلة' : 'سؤال'}</span><button class="btn sm" data-lib="${i}">${ic('upload')}تعيين</button></div>`).join('')}</div>`).join('')}`, foot: false,
    onMount(m, api) { $$('[data-lib]', m).forEach(b => b.onclick = () => { api.close(); editTask(c, null, LIB[+b.dataset.lib]); }); }});
}

/* ---------- answers display & grading ---------- */
function answerHtml(q, a) {
  const none = '<span class="muted">لم يُجب</span>';
  if (q.type === 'mcq') return a == null ? none : esc(q.options[+a] || '');
  if (q.type === 'tf') return a == null ? none : (a === 'true' ? 'صح' : 'خطأ');
  if (q.type === 'essay' && a && kwList(q).length) { const t2 = norm(a); return `<span style="white-space:pre-wrap">${esc(a)}</span><div class="rv-kw">${kwList(q).map(k => `<span class="${t2.includes(norm(k)) ? 'ok' : 'no'}">${t2.includes(norm(k)) ? '✓' : '✗'} ${esc(k)}</span>`).join('')}</div>`; }
  if (q.type === 'short' || q.type === 'essay' || q.type === 'order') return a ? `<span style="white-space:pre-wrap">${esc(a)}</span>` : none;
  if (q.type === 'match') return `<div class="rv-pairs">${(q.pairs || []).map((p, i) => { const ok = a && a[i] === p.b; return `<div class="${ok ? 'ok' : 'no'}"><span>${esc(p.a)}</span><i class="arw">←</i><span>${a && a[i] ? esc(a[i]) : '—'}</span><b>${ok ? '✓' : '✗'}</b></div>`; }).join('')}</div>`;
  if (q.type === 'link') return a ? 'أكّد إنهاء النشاط' : none;
}
function rightHtml(q) {
  if (q.type === 'mcq') return esc(q.options[q.answer] || '');
  if (q.type === 'tf') return q.answer === 'true' ? 'صح' : 'خطأ';
  if (q.type === 'short') return q.answer ? esc(String(q.answer).split('|').join(' أو ')) : '';
  if (q.type === 'order') return esc(q.sentence);
  if (q.type === 'match') return (q.pairs || []).map(p => esc(p.a + ' ← ' + p.b)).join('، ');
  if (q.type === 'essay') return [q.model ? esc(q.model) : '', kwList(q).length ? 'الكلمات المفتاحية: ' + kwList(q).map(esc).join('، ') : ''].filter(Boolean).join('<br>');
  return '';
}
const manualQ = q => (q.type === 'essay' && !kwList(q).length) || (q.type === 'short' && !q.answer);
function qStatus(q, score) { if (manualQ(q) && score == null) return ['wait', 'تحتاج تصحيحك']; const P = +q.pts || 0; return score >= P ? ['ok', 'صحيحة'] : score > 0 ? ['part', 'صحيحة جزئيًا'] : ['no', 'خاطئة']; }
/* review & grade one submission; list = submissions of the same task to move between students */
function gradeModal(t, sub, list) {
  list = list || DB.subs.filter(x => x.tid === t.id).sort((a, b) => ((stuById(a.sid) || {}).name || '').localeCompare((stuById(b.sid) || {}).name || '', 'ar'));
  const idx = list.findIndex(x => x.id === sub.id); const s = stuById(sub.sid);
  const sc = Object.assign({}, sub.scores || {});
  if (!sub.graded) t.qs.forEach(q => { if (manualQ(q) && !sub.reviewed) delete sc[q.id]; });
  const tot = total(t);
  const card = (q, i) => { const v = sc[q.id]; const [k, l] = qStatus(q, v); const right = rightHtml(q);
    return `<div class="rv-q ${k}" data-q="${esc(q.id)}"><div class="rv-h"><span class="qe-n">${i + 1}</span><b>${esc(q.text || QT[q.type])}</b><span class="grow"></span><span class="rv-st">${l}</span></div>
      <div class="rv-row"><span class="rv-k">إجابة الطالب</span><div class="rv-v">${answerHtml(q, (sub.answers || {})[q.id])}</div></div>
      ${right ? `<div class="rv-row"><span class="rv-k">${q.type === 'essay' ? 'الإجابة النموذجية' : 'الإجابة الصحيحة'}</span><div class="rv-v rv-right">${right}</div></div>` : ''}
      <div class="rv-g"><button type="button" data-full>${ic('check')}صحيحة</button><button type="button" data-zero>${ic('x')}خاطئة</button><label>الدرجة <input type="number" min="0" max="${esc(q.pts)}" step="0.25" data-g value="${v == null ? '' : esc(v)}" placeholder="—"> من ${fmt(q.pts)}</label></div></div>`; };
  App.modal({title: 'مراجعة إجابات: ' + (s ? s.name : ''), wide: true, body: `<div class="rv-top"><div><b>${esc(t.title)}</b><span class="small muted">سُلّمت ${esc(when(sub.at))}${sub.reviewed ? ' · راجعتِها' : sub.graded ? ' · صُحّحت تلقائيًا' : ''}</span></div><div class="rv-total"><b id="rvT"></b><span>من ${fmt(tot)}</span></div></div>
    ${t.desc ? `<details class="rv-desc"><summary>نص المهمة</summary><p>${esc(t.desc)}</p></details>` : ''}
    ${t.qs.map(card).join('')}
    <label class="f full" style="margin-top:10px"><span>ملاحظة للطالب (اختياري)</span><textarea id="gf" rows="2" placeholder="مثال: أحسنت، واصل التميز">${esc(sub.feedback || '')}</textarea></label>`,
  onMount(m) {
    const upd = () => { let n = 0, miss = 0; t.qs.forEach(q => { const inp = $(`[data-q="${q.id}"] [data-g]`, m); const v = inp.value === '' ? null : Math.min(+q.pts, Math.max(0, +inp.value)); if (v == null) miss++; else n += v; const [k, l] = qStatus(q, v); const box = $(`[data-q="${q.id}"]`, m); box.className = 'rv-q ' + k; $('.rv-st', box).textContent = l; });
      $('#rvT', m).textContent = fmt(n) + (miss ? ' +' : ''); $('#rvT', m).title = miss ? 'بقيت أسئلة لم تُصحَّح' : ''; };
    m.addEventListener('input', e => { if (e.target.matches('[data-g]')) upd(); });
    m.addEventListener('click', e => { const box = e.target.closest('.rv-q'); if (!box) return; const q = t.qs.find(x => x.id === box.dataset.q); const inp = $('[data-g]', box);
      if (e.target.closest('[data-full]')) { inp.value = q.pts; upd(); } else if (e.target.closest('[data-zero]')) { inp.value = 0; upd(); } });
    upd();
  },
  foot: [...(idx > 0 ? [{label: 'السابق', icon: 'right', onClick(api) { setTimeout(() => gradeModal(t, list[idx - 1], list), 30); }}] : []),
    ...(idx < list.length - 1 ? [{label: 'التالي', onClick(api) { setTimeout(() => gradeModal(t, list[idx + 1], list), 30); }}] : []), '|',
    {label: idx < list.length - 1 ? 'اعتماد والانتقال للتالي' : 'اعتماد الدرجة', cls: 'primary', icon: 'check', onClick(api) {
      const vals = {}; let miss = 0;
      t.qs.forEach(q => { const inp = $(`[data-q="${q.id}"] [data-g]`, api.el); if (inp.value === '') miss++; vals[q.id] = inp.value === '' ? 0 : Math.round(Math.min(+q.pts || 0, Math.max(0, +inp.value || 0)) * 100) / 100; });
      if (miss) { App.toast('بقي ' + miss + (miss > 2 ? ' أسئلة' : ' سؤال') + ' دون درجة. اضغطي «صحيحة» أو «خاطئة» أو اكتبي الدرجة.', true); return false; }
      const x = DB.subs.find(z => z.id === sub.id); x.scores = vals; x.feedback = $('#gf', api.el).value.trim(); x.graded = true; x.reviewed = true; x.gradedAt = Date.now(); save();
      App.toast('اعتُمدت درجة ' + (s ? s.name : '') + ': ' + fmt(got(x)) + ' من ' + fmt(tot));
      if (idx < list.length - 1) setTimeout(() => gradeModal(t, list[idx + 1], list), 60);
    }}]});
}
function resultsModal(c, t) {
  const st = studentsOf(c); const subs = st.map(s => subOf(t.id, s.id)).filter(Boolean);
  const list = subs.slice().sort((a, b) => (a.graded - b.graded) || ((stuById(a.sid) || {}).name || '').localeCompare((stuById(b.sid) || {}).name || '', 'ar'));
  const wait = subs.filter(x => !x.graded).length, notRev = subs.filter(x => x.graded && !x.reviewed).length;
  const g = subs.filter(x => x.graded); const avg = g.length ? pct(g.reduce((n, x) => n + got(x), 0), g.length * total(t)) : null;
  App.modal({title: 'نتائج: ' + t.title, wide: true, foot: false, body: st.length ? `<div class="stat-row" style="grid-template-columns:repeat(auto-fit,minmax(120px,1fr))"><div class="stat"><b>${subs.length}/${st.length}</b><span>سلّموا</span></div><div class="stat ${wait ? 'alert' : ''}"><b>${wait}</b><span>تحتاج تصحيحك</span></div><div class="stat"><b>${notRev}</b><span>صُحّحت تلقائيًا</span></div><div class="stat"><b>${avg == null ? '—' : avg + '%'}</b><span>متوسط الدرجات</span></div></div>
    ${subs.length ? `<button class="btn primary" data-all style="margin-bottom:12px">${ic('eye')}مراجعة كل الإجابات بالترتيب</button>` : ''}
    <div class="items">${st.map(s => { const sub = subOf(t.id, s.id);
    return `<div class="item"><div class="body"><div class="t">${esc(s.name)}</div><div class="meta">${!sub ? '<span class="badge">لم يسلّم</span>' : !sub.graded ? '<span class="badge mid">تحتاج تصحيحك</span>' : `<span class="badge low">${fmt(got(sub))} من ${fmt(total(t))}</span><span class="badge ${sub.reviewed ? 'acc' : ''}">${sub.reviewed ? 'راجعتِها' : 'تصحيح تلقائي'}</span>`}${sub ? `<span>${esc(when(sub.at))}</span>` : ''}</div></div>${sub ? `<div class="acts"><button class="btn sm" data-g="${esc(sub.id)}">${ic(sub.graded ? 'eye' : 'edit')}${sub.graded ? 'مراجعة الإجابات' : 'تصحيح'}</button></div>` : ''}</div>`; }).join('')}</div>` : '<p class="small muted">لم ينضم طلاب إلى هذا الفصل بعد.</p>',
    onMount(m, api) { $$('[data-g]', m).forEach(b => b.onclick = () => { api.close(); gradeModal(t, DB.subs.find(x => x.id === b.dataset.g), list); });
      const all = $('[data-all]', m); if (all) all.onclick = () => { api.close(); gradeModal(t, list[0], list); }; }});
}

/* ---------- incentives ---------- */
const CARDS = {gold: ['بطاقة إنجاز ذهبية', '#b8860b', '#fff6dc'], silver: ['بطاقة إنجاز فضية', '#6b7380', '#f2f4f7'], bronze: ['بطاقة إنجاز برونزية', '#a0582a', '#fbeee4'], thanks: ['شهادة شكر وتقدير', '#1f6f4a', '#eef8f1']};
function certHtml(c, s, kind) {
  const [title, col, bg] = CARDS[kind]; const st = studentStats(c, s.id); const p = {name: c.teacher || (S.profile || {}).name || '', school: c.school || (S.profile || {}).school || ''};
  return `<div class="cert" style="--cc:${col};--cb:${bg}"><div class="cert-in"><div class="cert-top"><span>${esc(p.school || '')}</span><span>${esc(c.subject || '')}</span></div><div class="cert-medal">${ic('trophy')}</div><div class="cert-t">${title}</div><p>${kind === 'thanks' ? 'تتقدم المعلمة بالشكر والتقدير إلى الطالب' : 'تهنئ المعلمة الطالب المتميز'}</p><div class="cert-n">${esc(s.name)}</div><div class="small">${esc(c.name)}</div><div class="cert-k"><div><b>${st.done}/${st.tasks}</b><span>المهام المنجزة</span></div><div><b>${st.avg == null ? '—' : st.avg + '%'}</b><span>متوسط الدرجات</span></div></div><p class="small">${kind === 'thanks' ? 'لجهوده المتميزة والتزامه، متمنين له دوام التفوق.' : 'لإنجازه مهامه بتميز وإتقان، بارك الله فيه.'}</p><div class="cert-f"><span>المعلمة<br><b>${esc(p.name || '')}</b></span><span>${esc(D.long(new Date()))}</span></div></div></div>`;
}
const suggest = avg => avg == null ? 'thanks' : avg >= 90 ? 'gold' : avg >= 75 ? 'silver' : avg >= 60 ? 'bronze' : 'thanks';
function certFile(inner) { return `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>شهادة</title><link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&display=swap" rel="stylesheet"><style>${CERT_CSS}body{font-family:"IBM Plex Sans Arabic",Tahoma,sans-serif;margin:24px}button{font:inherit;padding:8px 16px;margin-bottom:14px}@media print{button{display:none}body{margin:0}}</style></head><body><button onclick="print()">طباعة / حفظ PDF</button>${inner}</body></html>`; }
const CERT_CSS = `.cert{max-width:560px;margin:0 auto;padding:10px;border-radius:18px;background:var(--cb);border:3px solid var(--cc);color:#1b1b1b;text-align:center}.cert-in{border:1.5px solid var(--cc);border-radius:12px;padding:20px 18px}.cert-top{display:flex;justify-content:space-between;font-size:13px;color:#555}.cert-medal{width:64px;height:64px;margin:10px auto 6px;border-radius:50%;display:grid;place-items:center;background:var(--cc);color:#fff}.cert-medal svg{width:34px;height:34px}.cert-t{display:inline-block;background:var(--cc);color:#fff;font-weight:800;font-size:22px;padding:8px 26px;border-radius:99px;margin:6px 0 10px}.cert-n{font-size:28px;font-weight:800;color:var(--cc);margin:4px 0}.cert-k{display:flex;gap:12px;justify-content:center;margin:14px 0}.cert-k div{border:1.5px solid var(--cc);border-radius:12px;padding:8px 16px;background:#fff}.cert-k b{display:block;font-size:22px;color:var(--cc)}.cert-k span{font-size:12px;color:#555}.cert-f{display:flex;justify-content:space-between;align-items:end;font-size:13px;color:#555;margin-top:14px;text-align:start}`;

/* ---------- reports ---------- */
function studentReport(c, s) {
  const st = studentStats(c, s.id); const ts = tasksOf(c.id).filter(t => t.pub);
  App.modal({title: 'تقرير: ' + s.name, wide: true, body: `<div class="stat-row"><div class="stat"><b>${st.done}/${st.tasks}</b><span>المهام المنجزة</span></div><div class="stat"><b>${st.avg == null ? '—' : st.avg + '%'}</b><span>متوسط الدرجات</span></div><div class="stat"><b>${st.wait}</b><span>بانتظار التصحيح</span></div><div class="stat ${st.tasks - st.done ? 'alert' : ''}"><b>${st.tasks - st.done}</b><span>لم يسلّمها</span></div></div>
    <div class="tbl-wrap"><table class="data stack"><thead><tr><th>المهمة</th><th>الحالة</th><th>الدرجة</th><th>ملاحظة المعلمة</th></tr></thead><tbody>${ts.map(t => { const x = subOf(t.id, s.id); return `<tr><td><b>${esc(t.title)}</b></td><td>${!x ? '<span class="badge high">لم يسلّم</span>' : x.graded ? '<span class="badge low">مصحّحة</span>' : '<span class="badge mid">بانتظار التصحيح</span>'}</td><td class="n">${x && x.graded ? fmt(got(x)) + ' / ' + fmt(total(t)) : '—'}</td><td>${esc((x && x.feedback) || '')}</td></tr>`; }).join('')}</tbody></table></div>`,
  foot: [{label: 'تنزيل التقرير للطباعة', icon: 'printer', close: false, onClick() {
    App.save('تقرير-' + s.name.replace(/\s+/g, '-') + '.html', `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير ${esc(s.name)}</title><style>body{font-family:Tahoma,Arial,sans-serif;max-width:780px;margin:30px auto;padding:0 20px;line-height:1.7}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccd;padding:6px 8px;text-align:right}th{background:#eef1f8}@media print{button{display:none}}</style></head><body><button onclick="print()">طباعة</button><h1>تقرير إنجاز الطالب</h1><p>${esc(s.name)} · ${esc(c.name)} · ${esc(D.long(new Date()))}</p><p>المهام المنجزة: ${st.done} من ${st.tasks} · متوسط الدرجات: ${st.avg == null ? '—' : st.avg + '%'}</p><table><tr><th>المهمة</th><th>الدرجة</th><th>ملاحظة</th></tr>${ts.map(t => { const x = subOf(t.id, s.id); return `<tr><td>${esc(t.title)}</td><td>${!x ? 'لم يسلّم' : x.graded ? fmt(got(x)) + ' / ' + fmt(total(t)) : 'بانتظار التصحيح'}</td><td>${esc((x && x.feedback) || '')}</td></tr>`; }).join('')}</table></body></html>`);
  }}]});
}
function csv(c) {
  const ts = tasksOf(c.id).filter(t => t.pub).reverse(); const q = v => '"' + String(v).replace(/"/g, '""') + '"';
  const rows = [['الطالب', ...ts.map(t => t.title + ' (' + fmt(total(t)) + ')'), 'المنجز', 'المتوسط %']].concat(studentsOf(c).map(s => { const st = studentStats(c, s.id); return [s.name, ...ts.map(t => { const x = subOf(t.id, s.id); return !x ? 'لم يسلّم' : x.graded ? fmt(got(x)) : 'بانتظار التصحيح'; }), st.done + '/' + st.tasks, st.avg == null ? '' : st.avg]; }));
  App.save('درجات-' + c.name.replace(/\s+/g, '-') + '.csv', '﻿' + rows.map(r => r.map(q).join(',')).join('\r\n'));
}


/* ---------- students added by the teacher ---------- */
const newPin = () => String(Math.floor(1000 + Math.random() * 9000));
function credsModal(c, list, title) {
  const txt = `بيانات الدخول إلى مركز إنجاز الطلاب — ${c.name}\n` + list.map(s => `${s.name}: الرقم السري ${s.pin}`).join('\n');
  App.modal({title: title || 'بيانات دخول الطلاب', wide: true, body: `<p class="small muted" style="margin-top:0">يدخل كل طالب باسمه ورقمه السري. انسخي القائمة وأرسليها لأولياء الأمور.</p><div class="tbl-wrap"><table class="data"><thead><tr><th>الطالب</th><th>جوال ولي الأمر</th><th>الرقم السري</th></tr></thead><tbody>${list.map(s => `<tr><td>${esc(s.name)}</td><td class="n" dir="ltr">${esc(s.phone || '—')}</td><td class="n" dir="ltr"><b>${esc(s.pin)}</b></td></tr>`).join('')}</tbody></table></div>`,
    foot: [{label: 'نسخ القائمة', cls: 'primary', icon: 'copy', close: false, onClick() { copy(txt); }}]});
}
function addStudents(c) {
  App.modal({title: 'إضافة طلاب إلى ' + c.name, body: `<label class="f"><span>الطلاب (طالب في كل سطر: الاسم ثم جوال ولي الأمر)</span><textarea id="an" rows="8" placeholder="محمد عبدالله 0551234567&#10;سارة أحمد 0509876543&#10;…"></textarea></label><p class="small muted">يُنشأ لكل طالب رقم سري من 4 أرقام تلقائيًا. يمكنك لصق عمودي الاسم والجوال من Excel أو نور. من لم تكتبي جواله يُطلب منه عند أول دخول.</p>`,
  foot: [{label: 'إضافة', cls: 'primary', icon: 'plus', onClick(api) {
    const rows = App.val(api.el, '#an').split(/\n+/).map(line => { line = toEn(line); const m = line.match(/(?:\+?966|0)?5\d{8}/); const phone = m ? phoneOf(m[0]) : ''; const name = (m ? line.replace(m[0], ' ') : line).replace(/^[\d\s.\-–)]+/, '').replace(/[,،\t]+/g, ' ').trim().replace(/\s+/g, ' '); return {name, phone}; }).filter(r => r.name);
    if (!rows.length) { App.toast('اكتبي اسمًا واحدًا على الأقل', true); return false; }
    const cls = clsById(c.id), added = [];
    rows.forEach(({name, phone}) => {
      let s = DB.students.find(x => norm(x.name) === norm(name));
      if (!s) { s = {id: rid(), name, pin: newPin(), phone, at: Date.now(), byTeacher: true}; DB.students.push(s); }
      else if (phone && !s.phone) s.phone = phone;
      if (!(cls.students || []).includes(s.id)) cls.students = (cls.students || []).concat(s.id);
      added.push(s);
    });
    save(); setTimeout(() => credsModal(cls, added, 'تمت إضافة ' + added.length + (added.length > 2 ? ' طلاب' : ' طالب')), 60);
  }}]});
}
function editStudent(c, s) {
  App.modal({title: 'تعديل بيانات الطالب', body: `<div class="fgrid" style="grid-template-columns:1fr"><label class="f"><span>اسم الطالب</span><input id="en" value="${esc(s.name)}"></label><label class="f"><span>جوال ولي الأمر</span><input id="eph" dir="ltr" inputmode="tel" maxlength="10" value="${esc(s.phone || '')}" placeholder="05xxxxxxxx"></label>${DB.classes.length > 1 ? `<div class="f"><span>فصول الطالب</span><div class="ach-multi">${DB.classes.map(x => `<label class="chip"><input type="checkbox" data-sc="${esc(x.id)}" ${(x.students || []).includes(s.id) ? 'checked' : ''}>${esc(x.name)}</label>`).join('')}</div></div>` : ''}<label class="f"><span>الرقم السري</span><div class="row" style="gap:8px"><input id="ep" dir="ltr" inputmode="numeric" maxlength="4" value="${esc(s.pin)}" style="flex:1"><button type="button" class="btn sm" id="eg">${ic('spark')}رقم جديد</button></div></label></div><p class="small muted">إذا نسي الطالب رقمه السري، أعطيه الرقم الظاهر هنا أو أنشئي رقمًا جديدًا.</p>`,
    onMount(m) { $('#eg', m).onclick = () => { $('#ep', m).value = newPin(); }; },
    foot: [{label: 'حفظ', cls: 'primary', icon: 'check', onClick(api) {
      const name = App.val(api.el, '#en').replace(/\s+/g, ' '), pin = App.val(api.el, '#ep');
      if (!name) { App.toast('اكتبي اسم الطالب', true); return false; }
      if (!/^\d{4}$/.test(pin)) { App.toast('الرقم السري 4 أرقام', true); return false; }
      if (DB.students.some(x => x.id !== s.id && norm(x.name) === norm(name))) { App.toast('يوجد طالب آخر بهذا الاسم', true); return false; }
      const phone = phoneOf(App.val(api.el, '#eph')); if (phone && !okPhone(phone)) { App.toast('رقم الجوال يبدأ بـ 05 ويتكوّن من 10 أرقام', true); return false; }
      const boxes = $$('[data-sc]', api.el);
      if (boxes.length) { if (!boxes.some(b => b.checked)) { App.toast('اختاري فصلًا واحدًا على الأقل، أو أزيلي الطالب من الفصل', true); return false; }
        boxes.forEach(b => { const x = clsById(b.dataset.sc); const has = (x.students || []).includes(s.id); if (b.checked && !has) x.students = (x.students || []).concat(s.id); if (!b.checked && has) x.students = x.students.filter(i => i !== s.id); }); }
      Object.assign(stuById(s.id), {name, pin, phone}); save(); App.toast('تم حفظ بيانات الطالب');
    }}]});
}
/* ---------- the teacher page ---------- */
App.view('achieve', {title: 'فصولي', render(el) {
  if (CLOUD() && !cloudReady) { el.innerHTML = `<div class="loader"><div class="spin"></div><span>جارٍ تحميل فصولك…</span></div>`; return; }
  if (CLOUD() && App._eduErr) { el.innerHTML = App._eduErr === 'setup' ? App.empty('alert', 'لم يُفعَّل «فصولي» بعد', 'يحتاج «فصولي» وموقع الطلاب إلى تشغيل كود الإعداد مرة واحدة في Supabase. تواصلي مع مطوّرة المنصة.') : App.empty('alert', 'تعذّر تحميل فصولك', 'تحقّقي من الاتصال بالإنترنت ثم أعيدي المحاولة.', `<button class="btn primary" data-retry>${ic('spark')}إعادة المحاولة</button>`); const rt = $('[data-retry]', el); if (rt) rt.onclick = () => { App._eduErr = ''; cloudReady = false; App.render(); cloudLoad(); }; return; }
  const u = App.ui.ach; const list = DB.classes.slice().sort((a, b) => a.at - b.at);
  if (!list.length) { el.innerHTML = App.empty('trophy', 'أنشئي فصلك الأول', 'لكل فصل رمز ورابط دعوة. ينضم الطلاب بحساباتهم، فترسلين لهم المهام والتمارين التفاعلية، وتصححين وتتابعين الدرجات والتقارير.', `<button class="btn primary" data-newc>${ic('plus')}فصل جديد</button>${isTrial() ? `<button class="btn" data-demo style="margin-inline-start:8px">${ic('spark')}جرّبي ببيانات تجريبية</button>` : ''}`); bindCommon(el); return; }
  const c = list.find(x => x.id === u.cls);
  if (!c) {
    u.cls = null;
    el.innerHTML = `<div class="ach-actions"><button class="btn primary" data-newc>${ic('plus')}فصل جديد</button>${isTrial() ? `<button class="btn" data-stu>${ic('eye')}معاينة موقع الطلاب</button>${DB.classes.some(x => x.demo) ? `<button class="btn ghost danger" data-cleardemo>${ic('trash')}حذف البيانات التجريبية</button>` : `<button class="btn" data-demo>${ic('spark')}بيانات تجريبية</button>`}` : ''}</div>
    <div class="ach-cls">${list.map(x => { const sts = studentsOf(x), tts = tasksOf(x.id).filter(t => t.pub), w = DB.subs.filter(s => !s.graded && tts.some(t => t.id === s.tid)).length;
      return `<button class="ach-clc" data-open="${esc(x.id)}"><span class="ach-clh"><span class="ach-libi">${ic('book')}</span><span><b>${esc(x.name)}</b><small>${esc([x.grade, x.subject].filter(Boolean).join(' · ') || 'فصل')}</small></span></span>
      <span class="ach-cln"><span><b>${sts.length}</b>طالب</span><span><b>${tts.length}</b>مهمة</span><span class="${w ? 'warn' : ''}"><b>${w}</b>للتصحيح</span></span><span class="ach-code" dir="ltr">${esc(x.code)}</span></button>`; }).join('')}</div>`;
    bindCommon(el); $$('[data-open]', el).forEach(b => b.onclick = () => { u.cls = b.dataset.open; u.tab = 'tasks'; App.render(); }); return;
  }
  const st = studentsOf(c), ts = tasksOf(c.id);
  const waiting = DB.subs.filter(s => !s.graded && ts.some(t => t.id === s.tid));
  const avgs = st.map(s => studentStats(c, s.id).avg).filter(v => v != null);
  const head = `<div class="ach-bar"><button class="btn sm ghost" data-allc>${ic('right')}كل الفصول</button><select id="achCls" aria-label="الفصل">${list.map(x => `<option value="${esc(x.id)}" ${x.id === c.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select><button class="btn sm" data-newc>${ic('plus')}فصل جديد</button><span class="grow"></span>${isTrial() ? `<button class="btn sm ghost" data-stu>${ic('eye')}معاينة موقع الطلاب</button>` : ''}<button class="icon-btn" data-editc aria-label="إعدادات الفصل" title="إعدادات الفصل">${ic('sliders')}</button></div>
    <div class="ach-share"><span class="ach-code" dir="ltr">${esc(c.code)}</span><button class="btn sm ghost" data-cp="code">${ic('copy')}نسخ الرمز</button><button class="btn sm ghost" data-cp="link">${ic('link')}نسخ الرابط</button><button class="btn sm ghost" data-inv>${ic('globe')}دعوة ومشاركة</button></div>
    <div class="stat-row"><div class="stat"><b>${st.length}</b><span>طالب</span></div><div class="stat"><b>${ts.filter(t => t.pub).length}</b><span>مهمة مرسلة</span></div><div class="stat ${waiting.length ? 'alert' : ''}"><b>${waiting.length}</b><span>بانتظار التصحيح</span></div><div class="stat"><b>${avgs.length ? Math.round(avgs.reduce((a, b) => a + b, 0) / avgs.length) + '%' : '—'}</b><span>متوسط الفصل</span></div></div>
    <div class="tabs">${[['tasks', 'المهام', 'check'], ['students', 'الطلاب', 'user'], ['grades', 'الدرجات', 'grid'], ['msgs', 'الرسائل', 'bell'], ['rewards', 'الحوافز', 'trophy'], ['reports', 'التقارير', 'list']].map(([k, l, i]) => `<button class="chip ${u.tab === k ? 'on' : ''}" data-tab="${k}">${ic(i)}${l}</button>`).join('')}</div>`;
  let body = '';
  if (u.tab === 'tasks') {
    body = `<div class="ach-actions"><button class="btn primary" data-newt>${ic('plus')}إضافة مهمة جديدة</button><button class="btn" data-lib>${ic('book')}مكتبة التمارين</button></div>
    ${ts.length ? `<div class="items">${ts.map(t => { const n = st.filter(s => subOf(t.id, s.id)).length, w = DB.subs.filter(s => s.tid === t.id && !s.graded).length, late = t.due && t.due < D.ymd(new Date());
      return `<div class="item"><div class="body"><div class="t">${esc(t.title)}</div><div class="meta">${t.pub ? `<span class="badge ${n === st.length && st.length ? 'low' : 'acc'}">سلّمها ${n} من ${st.length}</span>` : '<span class="badge">مسودة</span>'}${w ? `<span class="badge mid">${w} بانتظار التصحيح</span>` : ''}<span>${t.qs.length} ${t.qs.length > 2 ? 'أسئلة' : 'سؤال'} · ${fmt(total(t))} درجة</span>${t.due ? `<span class="${late ? 'badge high' : ''}">التسليم ${esc(D.short(D.parse(t.due)))}</span>` : ''}</div></div>
      <div class="acts"><button class="btn sm" data-res="${esc(t.id)}">${ic('eye')}النتائج ومراجعة الإجابات</button><button class="icon-btn sm" data-et="${esc(t.id)}" aria-label="تعديل">${ic('edit')}</button><button class="icon-btn sm" data-dt="${esc(t.id)}" aria-label="حذف">${ic('trash')}</button></div></div>`; }).join('')}</div>` : App.empty('check', 'لا توجد مهام بعد', 'أضيفي مهمة بأسئلتك، أو اختاري تمرينًا جاهزًا من مكتبة التمارين.')}`;
  } else if (u.tab === 'students') {
    body = `<div class="ach-actions"><button class="btn primary" data-adds>${ic('plus')}إضافة طلاب</button><button class="btn" data-inv>${ic('globe')}دعوة برمز الفصل</button>${st.length ? `<button class="btn" data-creds>${ic('copy')}بيانات دخول الطلاب</button>` : ''}</div>
    <p class="small muted">طريقتان: تضيفين الطلاب بنفسك فتعطيهم أسماءهم وأرقامهم السرية، أو يسجّلون بأنفسهم ويدخلون برمز الفصل.</p>
    ${st.length ? `<div class="items">${st.map(s => { const x = studentStats(c, s.id); return `<div class="item"><div class="body"><div class="t">${esc(s.name)}</div><div class="meta"><span>أنجز ${x.done} من ${x.tasks}</span>${x.avg != null ? `<span class="badge acc">${x.avg}%</span>` : ''}${s.phone ? `<span dir="ltr">${esc(s.phone)}</span>` : '<span class="badge mid">لا يوجد جوال</span>'}${DB.classes.filter(x => x.id !== c.id && (x.students || []).includes(s.id)).map(x => `<span class="badge">${esc(x.name)}</span>`).join('')}</div></div><div class="acts">${s.phone ? `<a class="icon-btn sm" href="${esc(waLink(s.phone))}" target="_blank" rel="noopener" aria-label="مراسلة ولي الأمر عبر واتساب" title="واتساب ولي الأمر">${ic('globe')}</a>` : ''}<button class="btn sm" data-rep="${esc(s.id)}">${ic('list')}تقرير</button><button class="icon-btn sm" data-eds="${esc(s.id)}" aria-label="تعديل الطالب">${ic('edit')}</button><button class="icon-btn sm" data-rms="${esc(s.id)}" aria-label="إزالة من الفصل">${ic('trash')}</button></div></div>`; }).join('')}</div>` : App.empty('user', 'لا يوجد طلاب بعد', 'أضيفي الطلاب بنفسك، أو أرسلي لهم رمز الفصل.')}`;
  } else if (u.tab === 'grades') {
    const pts = ts.filter(t => t.pub).reverse();
    body = st.length && pts.length ? `<p class="small muted">اضغطي أي درجة لعرض الإجابات وتعديلها.</p><div class="tbl-wrap"><table class="data"><thead><tr><th>الطالب</th>${pts.map(t => `<th>${esc(t.title)}<br><span class="small">${fmt(total(t))}</span></th>`).join('')}<th>المتوسط</th></tr></thead><tbody>${st.map(s => `<tr><td><b>${esc(s.name)}</b></td>${pts.map(t => { const x = subOf(t.id, s.id); return `<td class="n">${!x ? '<span class="muted">—</span>' : `<button class="btn sm ${x.graded ? 'ghost' : ''}" data-gs="${esc(x.id)}">${x.graded ? fmt(got(x)) : 'صحّحي'}</button>`}</td>`; }).join('')}<td class="n"><b>${(v => v == null ? '—' : v + '%')(studentStats(c, s.id).avg)}</b></td></tr>`).join('')}</tbody></table></div>` : App.empty('grid', 'لا توجد درجات بعد', 'تظهر الدرجات هنا بعد أن يسلّم الطلاب المهام.');
  } else if (u.tab === 'msgs') {
    const ms = DB.msgs.filter(m => m.cls === c.id).sort((a, b) => b.at - a.at);
    body = `<div class="card" style="margin-bottom:14px"><h3>${ic('bell')}رسالة جديدة للطلاب</h3><div class="fgrid"><label class="f"><span>إلى</span><select id="mTo"><option value="">جميع طلاب الفصل</option>${st.map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select></label><label class="f"><span>العنوان *</span><input id="mT" placeholder="مثال: تذكير بموعد الاختبار"></label><label class="f full"><span>نص الرسالة</span><textarea id="mB" rows="3"></textarea></label></div><button class="btn primary" id="mSend" style="margin-top:12px">${ic('upload')}إرسال</button></div>
    ${ms.length ? `<div class="items">${ms.map(m => { const aud = m.to ? [m.to] : (c.students || []); return `<div class="item"><div class="body"><div class="t">${esc(m.title)}</div>${m.body ? `<div class="small" style="white-space:pre-wrap">${esc(m.body)}</div>` : ''}<div class="meta"><span>${m.to ? 'إلى ' + esc((stuById(m.to) || {}).name || '') : 'لجميع الفصل'}</span><span>${esc(when(m.at))}</span><span class="badge acc">قرأها ${(m.read || []).filter(x => aud.includes(x)).length} من ${aud.length}</span></div></div><div class="acts"><button class="icon-btn sm" data-dm="${esc(m.id)}" aria-label="حذف">${ic('trash')}</button></div></div>`; }).join('')}</div>` : ''}`;
  } else if (u.tab === 'rewards') {
    const sel = st.find(s => s.id === u.rs) || st[0];
    if (!sel) body = App.empty('trophy', 'لا يوجد طلاب بعد', 'تظهر الحوافز والشهادات بعد انضمام الطلاب.');
    else { const k = u.rk && CARDS[u.rk] ? u.rk : suggest(studentStats(c, sel.id).avg); u.rk = k;
      body = `<div class="fgrid" style="margin-bottom:12px"><label class="f"><span>الطالب</span><select id="rS">${st.map(s => `<option value="${esc(s.id)}" ${s.id === sel.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label><div class="f"><span style="font-weight:600;color:var(--muted);font-size:14px">نوع البطاقة</span><div class="seg" style="flex-wrap:wrap">${Object.entries(CARDS).map(([kk, v]) => `<button data-rk="${kk}" class="${kk === k ? 'on' : ''}">${v[0].replace('بطاقة إنجاز ', '').replace(' وتقدير', '')}</button>`).join('')}</div></div></div>
      <p class="small muted">يُقترح نوع البطاقة تلقائيًا حسب متوسط درجات الطالب، ويمكنك تغييره.</p>${certHtml(c, sel, k)}
      <div class="row" style="justify-content:center;margin-top:14px;gap:8px"><button class="btn primary" data-cert>${ic('printer')}تنزيل للطباعة</button><button class="btn" data-certmsg>${ic('bell')}إرسالها للطالب</button></div>`; }
  } else {
    const pts = ts.filter(t => t.pub);
    body = `<div class="ach-actions"><button class="btn" data-csv>${ic('download')}تنزيل الدرجات (Excel)</button></div>
    ${st.length ? `<div class="tbl-wrap"><table class="data stack"><thead><tr><th>الطالب</th><th>المنجز</th><th>بانتظار التصحيح</th><th>المتوسط</th><th></th></tr></thead><tbody>${st.map(s => { const x = studentStats(c, s.id); return `<tr><td><b>${esc(s.name)}</b></td><td class="n">${x.done} / ${x.tasks}</td><td class="n">${x.wait}</td><td class="n">${x.avg == null ? '—' : x.avg + '%'}</td><td><button class="btn sm" data-rep="${esc(s.id)}">تقرير الطالب</button></td></tr>`; }).join('')}</tbody></table></div>` : ''}
    ${pts.length ? `<h4 style="margin:20px 0 8px">متوسط كل مهمة</h4><div class="items">${pts.map(t => { const g = DB.subs.filter(x => x.tid === t.id && x.graded); const a = g.length ? pct(g.reduce((n, x) => n + got(x), 0), g.length * total(t)) : null; return `<div class="item"><div class="body"><div class="t">${esc(t.title)}</div><div class="ach-meter"><i style="width:${a || 0}%"></i></div></div><b class="n">${a == null ? '—' : a + '%'}</b></div>`; }).join('')}</div>` : ''}
    ${!st.length && !pts.length ? App.empty('list', 'لا توجد بيانات بعد', 'تظهر التقارير بعد انضمام الطلاب وتسليم المهام.') : ''}`;
  }
  el.innerHTML = head + body;
  bindCommon(el);
  $('#achCls', el).onchange = e => { u.cls = e.target.value; App.render(); };
  $('[data-allc]', el).onclick = () => { u.cls = null; App.render(); };
  $$('[data-tab]', el).forEach(b => b.onclick = () => { u.tab = b.dataset.tab; App.render(); });
  $('[data-editc]', el).onclick = () => editClass(c);
  $$('[data-inv]', el).forEach(b => b.onclick = () => inviteModal(c));
  $$('[data-cp]', el).forEach(b => b.onclick = () => copy(b.dataset.cp === 'code' ? c.code : inviteUrl(c)));
  const on = (sel, fn) => $$(sel, el).forEach(b => b.onclick = () => fn(b));
  on('[data-newt]', () => editTask(c)); on('[data-lib]', () => libModal(c));
  on('[data-et]', b => editTask(c, DB.tasks.find(t => t.id === b.dataset.et)));
  on('[data-res]', b => resultsModal(c, DB.tasks.find(t => t.id === b.dataset.res)));
  on('[data-dt]', async b => { if (!(await App.confirm('حذف هذه المهمة مع إجابات الطلاب ودرجاتهم؟'))) return; DB.tasks = DB.tasks.filter(t => t.id !== b.dataset.dt); DB.subs = DB.subs.filter(s => s.tid !== b.dataset.dt); save(); App.toast('تم حذف المهمة'); });
  on('[data-gs]', b => { const x = DB.subs.find(s => s.id === b.dataset.gs); const tk = DB.tasks.find(t => t.id === x.tid); gradeModal(tk, x, studentsOf(c).map(s => subOf(tk.id, s.id)).filter(Boolean)); });
  on('[data-rep]', b => studentReport(c, stuById(b.dataset.rep)));
  on('[data-adds]', () => addStudents(c));
  on('[data-eds]', b => editStudent(c, stuById(b.dataset.eds)));
  on('[data-creds]', () => credsModal(c, studentsOf(c)));
  on('[data-rms]', async b => { const s = stuById(b.dataset.rms); if (!(await App.confirm('إزالة «' + s.name + '» من الفصل؟ تبقى درجاته محفوظة إن عاد للانضمام.', 'إزالة'))) return; clsById(c.id).students = c.students.filter(x => x !== s.id); save(); App.toast('أُزيل الطالب من الفصل'); });
  on('[data-dm]', async b => { if (!(await App.confirm('حذف هذه الرسالة؟'))) return; DB.msgs = DB.msgs.filter(m => m.id !== b.dataset.dm); save(); });
  on('[data-csv]', () => csv(c));
  const send = $('#mSend', el); if (send) send.onclick = () => { const title = App.val(el, '#mT'); if (!title) { App.toast('اكتبي عنوان الرسالة', true); return; } DB.msgs.push({id: rid(), cls: c.id, to: $('#mTo', el).value || null, title, body: App.val(el, '#mB'), at: Date.now(), read: []}); save(); App.toast('أُرسلت الرسالة'); };
  const rS = $('#rS', el); if (rS) rS.onchange = () => { u.rs = rS.value; u.rk = null; App.render(); };
  on('[data-rk]', b => { u.rk = b.dataset.rk; App.render(); });
  on('[data-cert]', () => { const s = st.find(x => x.id === (u.rs || st[0].id)) || st[0]; App.save('شهادة-' + s.name.replace(/\s+/g, '-') + '.html', certFile(certHtml(c, s, u.rk))); });
  on('[data-certmsg]', () => { const s = st.find(x => x.id === (u.rs || st[0].id)) || st[0]; DB.msgs.push({id: rid(), cls: c.id, to: s.id, title: '🏆 ' + CARDS[u.rk][0], body: 'مبارك! حصلت على ' + CARDS[u.rk][0] + ' في فصل ' + c.name + '.', cert: u.rk, at: Date.now(), read: []}); save(); App.toast('أُرسلت البطاقة إلى ' + s.name); });
}});
function bindCommon(el) {
  $$('[data-newc]', el).forEach(b => b.onclick = () => editClass());
  $$('[data-demo]', el).forEach(b => b.onclick = () => seedDemo());
  $$('[data-cleardemo]', el).forEach(b => b.onclick = async () => { if (await App.confirm('حذف الفصلين والطلاب والمهام التجريبية؟ لا تتأثر فصولك الحقيقية.')) clearDemo(); });
  $$('[data-stu]', el).forEach(b => b.onclick = () => openStudent());
}


/* =====================================================================
   ربط «فصولي» بمنظّم المعلم: الإشعارات، ولوحة التحكم، والتقويم، والبحث
   ===================================================================== */
function tNotify(title, body, important) { if (ctx === 'student') return; try { if (App.notify && S.profile) App.notify({title, body, kind: 'class', ref: 'achieve'}, !!important); } catch(e) {} }
App.classesCard = () => {
  if (CLOUD() && !cloudReady) return '<p class="small muted">جارٍ تحميل فصولك…</p>';
  if (CLOUD() && App._eduErr) return '<p class="small muted">تعذّر تحميل الفصول الآن.</p>';
  const list = DB.classes.slice().sort((a, b) => a.at - b.at);
  if (!list.length) return `<p class="small muted">أنشئي فصلك الأول وأرسلي لطلابك المهام والتمارين.</p><a class="btn sm" href="#achieve">${ic('plus')}فصل جديد</a>`;
  const recent = DB.subs.filter(s => DB.tasks.some(t => t.id === s.tid)).sort((a, b) => b.at - a.at).slice(0, 3);
  return `<div class="mini">${list.map(c => { const ts = tasksOf(c.id); const w = DB.subs.filter(s => !s.graded && ts.some(t => t.id === s.tid)).length;
    return `<a class="m" href="#achieve" data-acls="${esc(c.id)}" style="color:inherit;text-decoration:none"><span class="t">${esc(c.name)}</span><span class="small muted">${studentsOf(c).length} طالب</span>${w ? `<span class="badge mid">${w} للتصحيح</span>` : ''}</a>`; }).join('')}</div>
    ${recent.length ? `<div class="small muted" style="margin:10px 0 4px">آخر التسليمات</div><div class="mini">${recent.map(s => { const t = DB.tasks.find(x => x.id === s.tid); return `<a class="m" href="#achieve" data-acls="${esc(t.cls)}" style="color:inherit;text-decoration:none"><span class="t">${esc((stuById(s.sid) || {}).name || '')} · ${esc(t.title)}</span><span class="badge ${s.graded ? 'low' : 'mid'}">${s.graded ? fmt(got(s)) + '/' + fmt(total(t)) : 'للتصحيح'}</span></a>`; }).join('')}</div>` : ''}`;
};
document.addEventListener('click', ev => { const a = ev.target.closest && ev.target.closest('[data-acls]'); if (a) { App.ui.ach.cls = a.dataset.acls; App.ui.ach.tab = 'tasks'; } }, true);
/* due dates of class tasks appear in the calendar and the week card */
document.addEventListener('DOMContentLoaded', () => {
  const base = App.agenda; if (!base) return;
  App.agenda = (from, to) => { const out = base(from, to);
    DB.tasks.forEach(t => { if (!t.pub || !t.due) return; const d = D.parse(t.due + 'T07:00'); if (d >= from && d < to) out.push({kind: 'ctask', id: t.id, title: 'تسليم «' + t.title + '» · ' + ((clsById(t.cls) || {}).name || ''), date: d, time: ''}); });
    return out.sort((a, b) => a.date - b.date); };
});
App.calExtra = d => DB.tasks.filter(t => t.pub && t.due === D.ymd(d)).map(t => `<div class="ev ctask" data-ctk="${esc(t.id)}" title="${esc('تسليم: ' + t.title)}">${ic('book')}${esc(t.title)} · ${esc((clsById(t.cls) || {}).name || '')}</div>`);
App.openClassTask = id => { const t = DB.tasks.find(x => x.id === id); if (!t) return; App.ui.ach.cls = t.cls; App.ui.ach.tab = 'tasks'; App.go('achieve'); setTimeout(() => resultsModal(clsById(t.cls), t), 120); };
App.searchExtra = s => { const out = [];
  DB.classes.forEach(c => c.name.includes(s) && out.push(['cls', c.id, c.name, 'فصل', 'book']));
  DB.tasks.forEach(t => t.title.includes(s) && out.push(['ctask', t.id, t.title + ' · ' + ((clsById(t.cls) || {}).name || ''), 'مهمة فصل', 'trophy']));
  DB.students.forEach(st => st.name.includes(s) && out.push(['stu', st.id, st.name, 'طالب', 'user']));
  return out; };
App.openSearchExtra = (k, id) => {
  if (k === 'cls') { App.ui.ach.cls = id; App.ui.ach.tab = 'tasks'; App.go('achieve'); }
  else if (k === 'ctask') App.openClassTask(id);
  else if (k === 'stu') { const c = DB.classes.find(x => (x.students || []).includes(id)); if (c) { App.ui.ach.cls = c.id; App.ui.ach.tab = 'students'; App.go('achieve'); setTimeout(() => studentReport(c, stuById(id)), 120); } }
};

/* =====================================================================
   بيانات تجريبية
   ===================================================================== */
const DEMO_PIN = '1234';
function seedDemo() {
  clearDemo(true);
  const now = Date.now(), day = 86400000, p = S.profile || {};
  const mk = (name, subject) => { const c = {id: rid(), name, subject, grade: 'الثالث الابتدائي', code: newCode(), students: [], at: now - 20 * day, teacher: p.name || '', school: p.school || '', demo: true}; DB.classes.push(c); return c; };
  const A = mk('الثالث أ', 'لغتي'), B = mk('الثالث ب', 'التوحيد');
  const people = [['أحمد سالم', '0551234567'], ['نورة خالد', '0502223344'], ['ريم عبدالله', '0533334455'], ['محمد فهد', '0544445566'], ['سارة علي', '0555556677'], ['يوسف ناصر', '0566667788']];
  const st = people.map(([name, phone], i) => { const s = {id: rid(), name, phone, pin: i ? String(2000 + i * 111) : DEMO_PIN, at: now - 19 * day, byTeacher: true, demo: true}; DB.students.push(s); return s; });
  A.students = st.slice(0, 5).map(s => s.id); B.students = [st[0], st[3], st[4], st[5]].map(s => s.id);
  const addT = (c, libTitle, daysAgo, due) => { const L = LIB.find(x => x.title === libTitle); const t = {id: rid(), cls: c.id, title: L.title, desc: L.desc || '', pub: true, at: now - daysAgo * day, due: due == null ? '' : D.ymd(new Date(now + due * day)), qs: L.qs.map(q => Object.assign(clone(q), {id: rid()})), demo: true}; DB.tasks.push(t); return t; };
  const tA = [addT(A, 'معاني الكلمات', 9, -5), addT(A, 'أبني جملة', 6, -2), addT(A, 'الفهم القرائي: النخلة', 3, 1), addT(A, 'التاء المربوطة والمفتوحة', 0.2, 3)];
  const tB = [addT(B, 'الأصول الثلاثة', 7, -3), addT(B, 'أركان الإسلام', 2, 2), addT(B, 'معنى العبادة', 0.1, 4)];
  /* fake submissions with real answers, corrected by the same autoScore the students get */
  const sub = (t, s, rate, graded, hrs) => {
    const auto = t.qs.filter(q => q.type !== 'essay'), nOk = Math.round(rate * auto.length);
    const ans = {}; let k = 0;
    t.qs.forEach(q => {
      if (q.type === 'essay') { ans[q.id] = rate >= .7 ? 'نصنع من جذعها الأبواب والسقوف.' : 'النخلة جميلة.'; return; }
      const ok = k++ < nOk;
      if (q.type === 'mcq') ans[q.id] = ok ? q.answer : (q.answer + 1) % q.options.length;
      else if (q.type === 'tf') ans[q.id] = ok ? q.answer : (q.answer === 'true' ? 'false' : 'true');
      else if (q.type === 'short') ans[q.id] = ok ? String(q.answer || '').split('|')[0] : 'لا أعرف';
      else if (q.type === 'order') { const w = q.sentence.split(' '); ans[q.id] = ok ? q.sentence : w.slice(1).concat(w[0]).join(' '); }
      else if (q.type === 'match') { const n = q.pairs.length, good = ok ? n : Math.max(0, n - 2); ans[q.id] = q.pairs.map((pr, i) => i < good ? pr.b : q.pairs[i === n - 1 ? good : i + 1].b); }
      else if (q.type === 'link') ans[q.id] = ok || null;
    });
    const r = autoScore(t, ans); const essay = t.qs.find(q => q.type === 'essay' || (q.type === 'short' && !q.answer));
    if (essay && graded) t.qs.filter(q => q.type === 'essay').forEach(q => { r.scores[q.id] = rate >= .7 ? q.pts : Math.round(q.pts / 2 * 2) / 2; });
    const isGraded = essay ? graded : true;
    DB.subs.push({id: rid(), tid: t.id, sid: s.id, answers: ans, scores: r.scores, graded: isGraded, at: t.at + (hrs || 20) * 3600000, gradedAt: essay && isGraded ? t.at + 40 * 3600000 : undefined, feedback: isGraded && pct(Object.values(r.scores).reduce((a, b) => a + b, 0), total(t)) >= 90 ? 'أحسنت، عمل متقن!' : '', demo: true});
  };
  const plan = {0: [1, .75, null, null], 1: [1, 1, 1, .67], 2: [.75, .5, null, null], 3: [.5, 1, .8, null], 4: [1, 1, .9, 1]};
  Object.entries(plan).forEach(([i, rates]) => rates.forEach((r, k) => { if (r != null) sub(tA[k], st[i], r, !(k === 2 && i !== '1'), 10 + k * 3); }));
  sub(tB[0], st[0], 1, true); sub(tB[0], st[3], .75, true); sub(tB[0], st[5], .5, true); sub(tB[1], st[4], 1, true); sub(tB[1], st[5], .83, true);
  const msg = (c, to, title, body, ago, cert) => DB.msgs.push({id: rid(), cls: c.id, to: to ? to.id : null, title, body, at: now - ago * 3600000, read: [], cert, demo: true});
  msg(A, null, 'مرحبًا بكم في مركز إنجاز الطلاب', 'ستجدون هنا مهامكم وتمارينكم ودرجاتكم. بالتوفيق للجميع!', 200);
  msg(A, null, 'لا تنسوا إحضار كتاب لغتي غدًا', '', 5);
  msg(A, st[4], '🏆 ' + CARDS.gold[0], 'مبارك! حصلت على ' + CARDS.gold[0] + ' في فصل الثالث أ.', 30, 'gold');
  msg(B, st[0], '🏆 ' + CARDS.silver[0], 'مبارك! حصلت على ' + CARDS.silver[0] + ' في فصل الثالث ب.', 20, 'silver');
  App.ui.ach.cls = null; save();
  App.modal({title: 'تمت إضافة البيانات التجريبية', body: `<p style="margin-top:0">أُضيف فصلان (الثالث أ، والثالث ب) و6 طلاب و7 مهام بدرجات ورسائل وبطاقات.</p><div class="ach-code big" style="font-size:20px;letter-spacing:0">أحمد سالم · <span dir="ltr">${DEMO_PIN}</span></div><p class="small muted" style="text-align:center">ادخلي بهذا الحساب من «معاينة موقع الطلاب» أو من شاشة الدخول ← طالب ← لدي حساب.</p>`, foot: [{label: 'افتحي موقع الطلاب الآن', cls: 'primary', icon: 'eye', onClick() { setStu(st[0].id); stuCls = A.id; openStudent(); }}]});
}
function clearDemo(quiet) {
  const ids = new Set(DB.students.filter(s => s.demo).map(s => s.id));
  DB.subs = DB.subs.filter(s => !s.demo); DB.msgs = DB.msgs.filter(m => !m.demo); DB.tasks = DB.tasks.filter(t => !t.demo);
  DB.classes = DB.classes.filter(c => !c.demo); DB.classes.forEach(c => { c.students = (c.students || []).filter(i => !ids.has(i)); });
  DB.students = DB.students.filter(s => !s.demo); if (curStu && ids.has(curStu)) setStu(null);
  if (DB.seen) ids.forEach(i => delete DB.seen[i]);
  if (!quiet) { App.ui.ach.cls = null; save(); App.toast('حُذفت البيانات التجريبية'); }
}

/* =====================================================================
   إشعارات الطالب
   ===================================================================== */
function stuNotifs(me) {
  const out = [], today = new Date(); today.setHours(0, 0, 0, 0); const tom = D.ymd(new Date(Date.now() + 86400000)), tdy = D.ymd(new Date());
  DB.classes.filter(c => (c.students || []).includes(me.id)).forEach(c => {
    tasksOf(c.id).filter(t => t.pub).forEach(t => { const x = subOf(t.id, me.id);
      out.push({at: t.at, ic: 'check', title: 'مهمة جديدة: ' + t.title, body: c.name, tid: t.id});
      if (x && x.gradedAt) out.push({at: x.gradedAt, ic: 'star', title: 'صحّحت المعلمة «' + t.title + '»', body: 'درجتك ' + fmt(got(x)) + ' من ' + fmt(total(t)) + (x.feedback ? ' · ' + x.feedback : ''), tid: t.id});
      if (!x && (t.due === tdy || t.due === tom)) out.push({at: +today + 1, ic: 'clock', title: (t.due === tdy ? 'آخر موعد اليوم: ' : 'آخر موعد غدًا: ') + t.title, body: c.name, tid: t.id, warn: true});
    });
    DB.msgs.filter(m => m.cls === c.id && (!m.to || m.to === me.id)).forEach(m => out.push({at: m.at, ic: m.cert ? 'trophy' : 'bell', title: m.cert ? 'هدية: ' + CARDS[m.cert][0] : 'رسالة: ' + m.title, body: m.cert ? c.name : (m.body || c.name), mid: m.id}));
  });
  return out.sort((a, b) => b.at - a.at).slice(0, 40);
}
const seenOf = id => ((DB.seen || {})[id] || 0);
let lastUnread = {};
function notifPanel(me) {
  const list = stuNotifs(me), seen = seenOf(me.id);
  App.modal({title: 'إشعاراتي', wide: true, foot: false, body: list.length ? `<div class="k-nlist">${list.map((n, i) => `<button class="k-n ${n.at > seen ? 'new' : ''} ${n.warn ? 'warn' : ''}" data-ni="${i}"><span class="k-nic">${ic(n.ic)}</span><span class="k-nb"><b>${esc(n.title)}</b><small>${esc(n.body || '')}</small></span><small class="k-nt">${n.at > Date.now() - 86400000 ? 'اليوم' : esc(when(n.at))}</small></button>`).join('')}</div>` : `<p class="muted">لا توجد إشعارات بعد.</p>`,
    onMount(m, api) { $$('[data-ni]', m).forEach(b => b.onclick = () => { const n = list[+b.dataset.ni]; api.close(); if (n.tid) { const t = DB.tasks.find(x => x.id === n.tid); const x = subOf(t.id, me.id); x ? viewResult(t, x) : solve(t); } else if (n.mid) { const msg = DB.msgs.find(x => x.id === n.mid); if (msg.cert) App.modal({title: CARDS[msg.cert][0], wide: true, foot: false, body: certHtml(clsById(msg.cls), me, msg.cert)}); } }); }});
  DB.seen = DB.seen || {}; DB.seen[me.id] = Date.now(); lastUnread[me.id] = 0;
  if (CLOUD()) { rpc('edu_stu_update', {p_id: curStu, p_token: curTok, p_phone: null, p_seen: DB.seen[me.id]}).catch(() => {}); stuRender(); } else save();
}

/* =====================================================================
   واجهة الطالب
   ===================================================================== */
let stuEl = null, pendingCode = '', stuCls = null;
function openStudent(code) {
  if (code) pendingCode = String(code).toUpperCase();
  useStudentDB();
  if (CLOUD() && curStu && !curTok) setStu(null);
  if (!stuEl) { stuEl = document.createElement('div'); stuEl.id = 'stuApp'; stuEl.setAttribute('role', 'dialog'); stuEl.setAttribute('aria-label', 'واجهة الطالب'); document.getElementById('app').appendChild(stuEl); }
  document.body.style.overflow = 'hidden';
  if (curStu && pendingCode) tryJoin(pendingCode);
  stuRender();
  if (CLOUD() && curStu && !pendingCode) stuRefresh();
}
function closeStudent(quiet) { if (stuEl) stuEl.remove(); stuEl = null; document.body.style.overflow = ''; useTeacherDB(); if (!quiet) App.render(); }
function tryJoin(code) {
  if (CLOUD()) return (async () => { try { const r = await rpc('edu_stu_join', {p_id: curStu, p_token: curTok, p_code: String(code).trim().toUpperCase()}); pendingCode = ''; stuCls = r.id; App.toast(r.already ? 'أنت منضم إلى هذا الفصل مسبقًا' : 'تم انضمامك إلى فصل ' + (r.name || '')); } catch (er) { if (er.code === 'no_class') pendingCode = ''; App.toast(errText(er), true); } await stuRefresh(); })();
  const c = DB.classes.find(x => x.code === String(code).trim().toUpperCase());
  if (!c) { App.toast('لا يوجد فصل بهذا الرمز. تأكد من الرمز وأعد المحاولة.', true); return false; }
  pendingCode = '';
  if ((c.students || []).includes(curStu)) { stuCls = c.id; App.toast('أنت منضم إلى هذا الفصل مسبقًا'); return true; }
  c.students = (c.students || []).concat(curStu); stuCls = c.id; save(); App.toast('تم انضمامك إلى فصل ' + c.name);
  tNotify('انضم «' + ((stuById(curStu) || {}).name || '') + '» إلى فصل ' + c.name, 'عبر رمز الفصل'); return true;
}
function starsOf(t, x) { if (!x || !x.graded) return 0; const p = pct(got(x), total(t)); return p >= 90 ? 3 : p >= 70 ? 2 : p > 0 ? 1 : 0; }
const starRow = n => `<span class="k-stars" aria-label="${n} من 3 نجوم">${[0, 1, 2].map(i => `<svg viewBox="0 0 24 24" class="${i < n ? 'on' : ''}"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/></svg>`).join('')}</span>`;
const ring = p => `<svg class="k-ring" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="50" class="bg"/><circle cx="60" cy="60" r="50" class="fg" style="stroke-dasharray:${(p / 100 * 314).toFixed(1)} 314"/></svg>`;
const heroArt = `<svg class="k-art" viewBox="0 0 200 140" aria-hidden="true"><circle cx="150" cy="38" r="22" fill="#ffd54a"/><g fill="#fff" opacity=".9"><ellipse cx="60" cy="40" rx="30" ry="12"/><ellipse cx="80" cy="32" rx="20" ry="13"/><ellipse cx="170" cy="92" rx="22" ry="9"/></g><path d="M0 140 Q50 95 100 120 T200 110 V140Z" fill="#ffffff" opacity=".18"/><g fill="#ffd54a"><path d="M30 92l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/><path d="M118 70l2 4 4 .6-3 3 .7 4.4-3.7-2-3.7 2 .7-4.4-3-3 4-.6z"/></g></svg>`;
function stuRender() {
  if (!stuEl) return;
  const me = curStu && stuById(curStu);
  const backBtn = isTrial() ? `<button class="k-topbtn" data-back>${ic('right')}<span>${ss.get(KROLE) === 'teacher' ? 'واجهة المعلمة' : 'تغيير الحساب'}</span></button>` : '';
  const unread = me ? stuNotifs(me).filter(n => n.at > seenOf(me.id)).length : 0;
  if (me && unread > (lastUnread[me.id] == null ? unread : lastUnread[me.id])) App.toast('🔔 وصلك إشعار جديد');
  if (me) lastUnread[me.id] = unread;
  const top = `<header class="k-top"><div class="k-brand"><span class="k-logo">${ic('trophy')}</span><span><b>مركز إنجاز الطلاب</b><small>من منصة منظّم المعلم</small></span></div><span class="grow"></span>${me ? `<button class="k-bell" data-bell aria-label="الإشعارات${unread ? ' (' + unread + ' جديدة)' : ''}">${ic('bell')}${unread ? `<span dir="ltr">${unread > 9 ? '9+' : unread}</span>` : ''}</button>` : ''}${me ? `<button class="k-topbtn" data-out>${ic('logout')}<span>خروج</span></button>` : ''}${backBtn}</header>`;
  const bindTop = () => {
    const qb = $('[data-back]', stuEl); if (qb) qb.onclick = () => { if (ss.get(KROLE) === 'teacher') closeStudent(); else { closeStudent(true); showGate('pick'); } };
    const qo = $('[data-out]', stuEl); if (qo) qo.onclick = () => { setStu(null); stuCls = null; if (CLOUD()) DB = emptyDB(); stuRender(); };
    const qn = $('[data-bell]', stuEl); if (qn) qn.onclick = () => notifPanel(stuById(curStu));
  };
  if (CLOUD() && curStu && (!stuLoaded || (stuErr && !me))) {
    stuEl.innerHTML = top + `<div class="k-auth"><div class="k-empty" style="width:min(440px,100%)">${stuErr ? `<div class="k-emptyic">${ic('alert')}</div><b>تعذّر فتح حسابك</b><p>${esc(stuErr)}</p><button class="k-btn" data-retry>إعادة المحاولة</button>` : `<div class="spin" style="margin:10px auto"></div><p>جارٍ تحميل مهامك…</p>`}</div></div>`;
    bindTop(); const rt = $('[data-retry]', stuEl); if (rt) rt.onclick = () => { stuErr = ''; stuLoaded = false; stuRender(); stuRefresh(); };
    return;
  }
  /* ---------- sign in / sign up ---------- */
  if (!me) {
    const pc = pendingCode && DB.classes.find(x => x.code === pendingCode);
    stuEl.innerHTML = top + `<div class="k-auth"><div class="k-authcard"><div class="k-authart">${heroArt}<b>${stuMode === 'new' ? 'أهلًا بك يا بطل!' : 'مرحبًا بعودتك!'}</b><span>${stuMode === 'new' ? 'أنشئ حسابك وابدأ رحلة الإنجاز' : 'ادخل باسمك ورقمك السري'}</span></div>
      ${pc ? `<div class="k-note">${ic('info')}<span>بعد الدخول ستنضم إلى فصل «${esc(pc.name)}».</span></div>` : ''}
      ${isTrial() && DB.students.some(s => s.demo && s.pin === DEMO_PIN) ? `<button class="k-note k-demo" data-demo>${ic('info')}<span>حساب تجريبي: <b>أحمد سالم</b> · الرقم السري <b dir="ltr">${DEMO_PIN}</b> — اضغط للدخول به</span></button>` : ''}
      <div class="k-switch"><button data-m="new" class="${stuMode === 'new' ? 'on' : ''}">حساب جديد</button><button data-m="in" class="${stuMode === 'in' ? 'on' : ''}">لدي حساب</button></div>
      <form id="stuF" class="k-form"><label><span>اسمك الكامل</span><input id="sN" autocomplete="off" placeholder="مثال: محمد عبدالله"></label>
      ${stuMode === 'new' ? '<label><span>جوال ولي الأمر</span><input id="sM" dir="ltr" inputmode="tel" maxlength="10" placeholder="05xxxxxxxx"></label>' : ''}
      <label><span>رقمك السري (4 أرقام)</span><input id="sP" inputmode="numeric" maxlength="4" dir="ltr" placeholder="••••"></label>
      ${stuMode === 'new' ? '<label><span>أعد كتابة الرقم السري</span><input id="sP2" inputmode="numeric" maxlength="4" dir="ltr" placeholder="••••"></label>' : ''}
      <button class="k-btn" type="submit">${stuMode === 'new' ? 'إنشاء الحساب' : 'دخول'}</button></form></div></div>`;
    bindTop();
    $$('[data-m]', stuEl).forEach(b => b.onclick = () => { stuMode = b.dataset.m; stuRender(); });
    const dm = $('[data-demo]', stuEl); if (dm) dm.onclick = () => { const s = DB.students.find(x => x.demo && x.pin === DEMO_PIN); setStu(s.id); stuRender(); };
    $('#stuF', stuEl).onsubmit = async e => {
      e.preventDefault(); const q = s => $(s, stuEl); const name = q('#sN').value.trim().replace(/\s+/g, ' '), pin = toEn(q('#sP').value.trim());
      if (name.split(' ').length < 2) { App.toast('اكتب اسمك الأول واسم الأب على الأقل', true); return; }
      if (!/^\d{4}$/.test(pin)) { App.toast('الرقم السري 4 أرقام', true); return; }
      if (CLOUD()) {
        const btn = q('#stuF .k-btn'); btn.disabled = true;
        try {
          let r;
          if (stuMode === 'new') {
            if (pin !== toEn(q('#sP2').value.trim())) { App.toast('الرقمان السريان غير متطابقين', true); btn.disabled = false; return; }
            const phone = phoneOf(q('#sM').value); if (!okPhone(phone)) { App.toast('اكتب جوال ولي الأمر: يبدأ بـ 05 ويتكوّن من 10 أرقام', true); btn.disabled = false; return; }
            r = await rpc('edu_stu_register', {p_name: name, p_key: norm(name), p_phone: phone, p_pin: pin}); App.toast('تم إنشاء حسابك');
          } else r = await rpc('edu_stu_login', {p_key: norm(name), p_pin: pin});
          setStu(r.id, r.token);
          if (pendingCode) await tryJoin(pendingCode); else await stuRefresh();
        } catch (er) { App.toast(errText(er), true); btn.disabled = false; }
        return;
      }
      const found = DB.students.find(s => norm(s.name) === norm(name));
      if (stuMode === 'new') {
        if (pin !== toEn(q('#sP2').value.trim())) { App.toast('الرقمان السريان غير متطابقين', true); return; }
        if (found) { App.toast('يوجد حساب بهذا الاسم. اختر «لدي حساب».', true); return; }
        const phone = phoneOf(q('#sM').value); if (!okPhone(phone)) { App.toast('اكتب جوال ولي الأمر: يبدأ بـ 05 ويتكوّن من 10 أرقام', true); return; }
        const s = {id: rid(), name, pin, phone, at: Date.now()}; DB.students.push(s); setStu(s.id); App.toast('تم إنشاء حسابك');
      } else {
        if (!found || found.pin !== pin) { App.toast('الاسم أو الرقم السري غير صحيح', true); return; }
        setStu(found.id);
      }
      if (pendingCode) tryJoin(pendingCode); save();
    };
    return;
  }
  /* ---------- parent phone is required ---------- */
  if (!okPhone(me.phone || '')) {
    stuEl.innerHTML = top + `<div class="k-auth"><div class="k-authcard"><div class="k-authart">${heroArt}<b>خطوة أخيرة يا ${esc(me.name.split(' ')[0])}</b><span>اكتب رقم جوال ولي الأمر لتتمكن المعلمة من التواصل معه</span></div><form id="phF" class="k-form"><label><span>جوال ولي الأمر</span><input id="phI" dir="ltr" inputmode="tel" maxlength="10" placeholder="05xxxxxxxx"></label><button class="k-btn" type="submit">متابعة</button></form></div></div>`;
    bindTop();
    $('#phF', stuEl).onsubmit = ev => { ev.preventDefault(); const p = phoneOf($('#phI', stuEl).value); if (!okPhone(p)) { App.toast('الرقم يبدأ بـ 05 ويتكوّن من 10 أرقام', true); return; } if (CLOUD()) { rpc('edu_stu_update', {p_id: curStu, p_token: curTok, p_phone: p, p_seen: null}).then(stuRefresh).catch(er => App.toast(errText(er), true)); return; } stuById(me.id).phone = p; save(); };
    return;
  }
  /* ---------- home ---------- */
  const mine = DB.classes.filter(c => (c.students || []).includes(me.id));
  const c = mine.find(x => x.id === stuCls) || mine[0]; if (c) stuCls = c.id;
  const first = esc(me.name.split(' ')[0]);
  let main = '';
  if (!c) {
    main = `<div class="k-empty"><div class="k-emptyic">${ic('book')}</div><b>انضم إلى فصلك</b><p>اكتب رمز الفصل الذي أرسلته لك المعلمة.</p><div class="k-join"><input id="jc" dir="ltr" maxlength="6" placeholder="مثال: 8KD24Q"><button class="k-btn" id="jb">انضمام</button></div></div>`;
  } else {
    const ts = tasksOf(c.id).filter(t => t.pub);
    const fresh = ts.filter(t => !subOf(t.id, me.id)), done = ts.filter(t => subOf(t.id, me.id));
    const stt = studentStats(c, me.id); const stars = done.reduce((n, t) => n + starsOf(t, subOf(t.id, me.id)), 0);
    const msgs = DB.msgs.filter(m => m.cls === c.id && (!m.to || m.to === me.id)).sort((a, b) => b.at - a.at);
    const unread = msgs.filter(m => !(m.read || []).includes(me.id)); const certs = msgs.filter(m => m.cert);
    const prog = ts.length ? Math.round(done.length / ts.length * 100) : 0;
    const tile = t => { const x = subOf(t.id, me.id), late = t.due && t.due < D.ymd(new Date()) && !x; const st = !x ? (late ? 'late' : 'new') : x.graded ? 'done' : 'wait';
      return `<button class="k-tile ${st}" data-open="${esc(t.id)}"><span class="k-tileic">${ic(QI[t.qs[0].type])}</span><b>${esc(t.title)}</b>
        <span class="k-tilemeta">${st === 'new' ? 'ابدأ الآن' : st === 'late' ? 'متأخرة، أنجزها الآن' : st === 'wait' ? 'بانتظار تصحيح المعلمة' : `${fmt(got(x))} من ${fmt(total(t))}`}${t.due && !x ? ` · حتى ${esc(D.short(D.parse(t.due)))}` : ''}</span>
        ${st === 'done' ? starRow(starsOf(t, x)) : `<span class="k-go">${ic('left')}</span>`}</button>`; };
    main = `${unread.map(m => `<div class="k-msg ${m.cert ? 'gift' : ''}"><span class="k-msgav">${ic(m.cert ? 'trophy' : 'bell')}</span><div class="k-bubble"><small>${m.cert ? 'هدية من المعلمة' : 'رسالة من المعلمة'} · ${esc(when(m.at))}</small><b>${esc(m.title)}</b>${m.body ? `<p>${esc(m.body)}</p>` : ''}<div class="k-msgact">${m.cert ? `<button class="k-btn sm" data-showcert="${esc(m.id)}">افتح البطاقة</button>` : ''}<button class="k-btn sm ghost" data-rd="${esc(m.id)}">قرأتها ${ic('check')}</button></div></div></div>`).join('')}
      <h2 class="k-h">مهامي الجديدة ${fresh.length ? `<span class="k-count">${fresh.length}</span>` : ''}</h2>
      ${fresh.length ? `<div class="k-tiles">${fresh.map(tile).join('')}</div>` : `<div class="k-done">${ic('check')}<span>${ts.length ? 'أحسنت! أنجزت كل مهامك.' : 'لا توجد مهام بعد. ستظهر هنا عندما ترسلها المعلمة.'}</span></div>`}
      ${done.length ? `<h2 class="k-h">أنجزتها</h2><div class="k-tiles">${done.map(tile).join('')}</div>` : ''}
      ${certs.length ? `<h2 class="k-h">خزانة إنجازاتي</h2><div class="k-shelf">${certs.map(m => `<button class="k-medal ${esc(m.cert)}" data-showcert="${esc(m.id)}"><span>${ic('trophy')}</span><b>${esc(CARDS[m.cert][0].replace('بطاقة إنجاز ', ''))}</b><small>${esc(when(m.at))}</small></button>`).join('')}</div>` : ''}
      ${msgs.length - unread.length ? `<details class="k-old"><summary>الرسائل السابقة (${msgs.length - unread.length})</summary>${msgs.filter(m => (m.read || []).includes(me.id)).map(m => `<div><b>${esc(m.title)}</b>${m.body ? ` — ${esc(m.body)}` : ''} <small>${esc(when(m.at))}</small></div>`).join('')}</details>` : ''}`;
    main = `<section class="k-hero"><div class="k-herotxt"><span class="k-hi">مرحبًا يا ${first}</span>${c.teacher ? `<span class="k-teach">${ic('user')}المعلمة ${esc(c.teacher)}${c.subject ? ' · ' + esc(c.subject) : ''}</span>` : ''}<b>${fresh.length ? `لديك ${fresh.length === 1 ? 'مهمة جديدة' : fresh.length === 2 ? 'مهمتان جديدتان' : fresh.length + ' مهام جديدة'}` : 'أنت بطل الإنجاز!'}</b>
      <div class="k-chips">${mine.map(x => `<button class="${x.id === c.id ? 'on' : ''}" data-sc="${esc(x.id)}">${esc(x.name)}</button>`).join('')}<button data-join>${ic('plus')}فصل آخر</button></div></div>
      <div class="k-prog">${ring(prog)}<div><b>${prog}%</b><span>إنجازي</span></div></div>${heroArt}</section>
      <div class="k-stats"><div><span class="k-sic star">${ic('star')}</span><b>${stars}</b><small>نجومي</small></div><div><span class="k-sic ok">${ic('check')}</span><b>${done.length}/${ts.length}</b><small>مهام أنجزتها</small></div><div><span class="k-sic acc">${ic('target')}</span><b>${stt.avg == null ? '—' : stt.avg + '%'}</b><small>متوسط درجاتي</small></div><div><span class="k-sic gold">${ic('trophy')}</span><b>${certs.length}</b><small>بطاقات الإنجاز</small></div></div>${main}`;
  }
  stuEl.innerHTML = top + `<div class="k-wrap">${!c ? `<section class="k-hero"><div class="k-herotxt"><span class="k-hi">مرحبًا يا ${first}</span><b>لنبدأ رحلة الإنجاز!</b></div>${heroArt}</section>` : ''}${main}</div>`;
  bindTop();
  const q = s => $(s, stuEl), qa = s => $$(s, stuEl);
  qa('[data-sc]').forEach(b => b.onclick = () => { stuCls = b.dataset.sc; stuRender(); });
  const jb = q('#jb'); if (jb) { jb.onclick = () => { tryJoin(q('#jc').value); stuRender(); }; q('#jc').onkeydown = e => { if (e.key === 'Enter') jb.click(); }; }
  q('[data-join]') && (q('[data-join]').onclick = () => App.prompt('الانضمام إلى فصل', '', 'رمز الفصل').then(v => { if (v) { tryJoin(v); stuRender(); } }));
  qa('[data-rd]').forEach(b => b.onclick = () => { const m = DB.msgs.find(x => x.id === b.dataset.rd); m.read = (m.read || []).concat(curStu); if (CLOUD()) { rpc('edu_stu_read', {p_id: curStu, p_token: curTok, p_mid: m.id}).catch(er => App.toast(errText(er), true)); stuRender(); } else save(); });
  qa('[data-showcert]').forEach(b => b.onclick = () => { const m = DB.msgs.find(x => x.id === b.dataset.showcert); App.modal({title: CARDS[m.cert][0], wide: true, foot: false, body: certHtml(clsById(m.cls), stuById(curStu), m.cert)}); });
  qa('[data-open]').forEach(b => b.onclick = () => { const t = DB.tasks.find(x => x.id === b.dataset.open); const x = subOf(t.id, curStu); x ? viewResult(t, x) : solve(t); });
}

let stuMode = 'new';

function solve(t, preview) {
  const ord = {};
  const qHtml = (q, i) => {
    let f = '';
    if (q.type === 'mcq') f = `<div class="stu-ch">${q.options.map((o, k) => `<label><input type="radio" name="q${i}" value="${k}"><span>${esc(o)}</span></label>`).join('')}</div>`;
    if (q.type === 'tf') f = `<div class="stu-ch two"><label><input type="radio" name="q${i}" value="true"><span>صح ✓</span></label><label><input type="radio" name="q${i}" value="false"><span>خطأ ✗</span></label></div>`;
    if (q.type === 'short') f = `<input type="text" data-ans placeholder="اكتب إجابتك">`;
    if (q.type === 'essay') f = `<textarea data-ans rows="4" placeholder="اكتب إجابتك"></textarea>`;
    if (q.type === 'match') { const opts = shuffle(q.pairs.map(p => p.b)); f = `<div class="stu-match">${q.pairs.map((p, k) => `<label><b>${esc(p.a)}</b><i class="arw">←</i><select data-mi="${k}"><option value="">اختر</option>${opts.map(o => `<option>${esc(o)}</option>`).join('')}</select></label>`).join('')}</div>`; }
    if (q.type === 'order') { let w = q.sentence.trim().split(/\s+/); let s = shuffle(w); for (let n = 0; n < 5 && s.join(' ') === w.join(' '); n++) s = shuffle(w); ord[q.id] = {pool: s, picked: []}; f = `<div class="stu-built" data-built></div><div class="stu-words" data-pool></div><button type="button" class="btn sm ghost" data-reset>${ic('x')}إعادة الترتيب</button>`; }
    if (q.type === 'link') f = `<a class="btn" href="${esc(App.safeUrl ? App.safeUrl(q.url) : q.url)}" target="_blank" rel="noopener">${ic('game')}افتح النشاط</a><label class="row" style="gap:8px;margin-top:10px"><input type="checkbox" data-done> أنهيت النشاط</label>`;
    return `<div class="stu-q" data-q="${esc(q.id)}"><div class="stu-qh"><b>${i + 1}. ${esc(q.text || QT[q.type])}</b><span class="badge">${fmt(q.pts)} ${+q.pts === 1 ? 'درجة' : 'درجات'}</span></div>${f}</div>`;
  };
  App.modal({title: t.title, wide: true, body: `${t.desc ? `<div class="stu-read">${esc(t.desc)}</div>` : ''}${t.qs.map(qHtml).join('')}`,
    onMount(m) {
      const drawOrd = card => { const o = ord[card.dataset.q]; $('[data-built]', card).innerHTML = o.picked.length ? o.picked.map((w, k) => `<button type="button" class="chip on" data-un="${k}">${esc(w)}</button>`).join('') : '<span class="small muted">اضغط الكلمات بالترتيب الصحيح</span>'; $('[data-pool]', card).innerHTML = o.pool.map((w, k) => `<button type="button" class="chip" data-pk="${k}">${esc(w)}</button>`).join(''); };
      $$('.stu-q', m).forEach(card => { if (ord[card.dataset.q]) drawOrd(card); });
      m.addEventListener('click', e => { const card = e.target.closest('.stu-q'); if (!card || !ord[card.dataset.q]) return; const o = ord[card.dataset.q];
        const pk = e.target.closest('[data-pk]'), un = e.target.closest('[data-un]');
        if (pk) o.picked.push(o.pool.splice(+pk.dataset.pk, 1)[0]); else if (un) o.pool.push(o.picked.splice(+un.dataset.un, 1)[0]); else if (e.target.closest('[data-reset]')) { o.pool = o.pool.concat(o.picked); o.picked = []; } else return;
        drawOrd(card); });
    },
    foot: preview ? [{label: 'إغلاق المعاينة', cls: 'primary', onClick() {}}] : [{label: 'تسليم الإجابات', cls: 'primary', icon: 'check', async onClick(api) {
      const ans = {}; let empty = 0;
      t.qs.forEach((q, i) => { const card = $(`[data-q="${q.id}"]`, api.el); let a = null;
        if (q.type === 'mcq' || q.type === 'tf') { const r = $('input:checked', card); a = r ? (q.type === 'mcq' ? +r.value : r.value) : null; }
        else if (q.type === 'short' || q.type === 'essay') a = $('[data-ans]', card).value.trim() || null;
        else if (q.type === 'match') { a = $$('[data-mi]', card).map(s => s.value || null); if (a.every(v => !v)) a = null; }
        else if (q.type === 'order') a = ord[q.id].picked.join(' ') || null;
        else if (q.type === 'link') a = $('[data-done]', card).checked || null;
        if (a == null) empty++; ans[q.id] = a; });
      if (empty && !(await App.confirm(`لم تُجب عن ${empty} ${empty > 2 ? 'أسئلة' : 'سؤال'}. هل تريد التسليم الآن؟`, 'تسليم', false))) return false;
      const r = autoScore(t, ans);
      if (CLOUD()) {
        try { await rpc('edu_stu_submit', {p_id: curStu, p_token: curTok, p_tid: t.id, p_data: {answers: ans, scores: r.scores, graded: !r.needs}}); }
        catch (er) { App.toast(errText(er), true); if (er.code !== 'already') return false; await stuRefresh(); return; }
        await stuRefresh();
        App.toast(r.needs ? 'تم التسليم. ستظهر درجتك بعد تصحيح المعلمة.' : `أحسنت! درجتك ${fmt(Object.values(r.scores).reduce((a, b) => a + b, 0))} من ${fmt(total(t))}`); return;
      }
      DB.subs.push({id: rid(), tid: t.id, sid: curStu, answers: ans, scores: r.scores, graded: !r.needs, at: Date.now()}); save();
      const cn = (clsById(t.cls) || {}).name || ''; tNotify('سلّم «' + ((stuById(curStu) || {}).name || '') + '» مهمة «' + t.title + '»', cn + (r.needs ? ' · تحتاج تصحيحك' : ' · صُحّحت تلقائيًا: ' + fmt(Object.values(r.scores).reduce((a, b) => a + b, 0)) + ' من ' + fmt(total(t))), r.needs);
      App.toast(r.needs ? 'تم التسليم. ستظهر درجتك بعد تصحيح المعلمة.' : `أحسنت! درجتك ${fmt(Object.values(r.scores).reduce((a, b) => a + b, 0))} من ${fmt(total(t))}`);
    }}]});
}
function viewResult(t, x) {
  App.modal({title: t.title, wide: true, foot: false, body: x.graded ? `<div class="ach-score"><b>${fmt(got(x))}</b><span>من ${fmt(total(t))}</span></div>${x.feedback ? `<div class="ann" style="margin-bottom:12px"><span class="ann-ic">${ic('note')}</span><div><div class="small muted">ملاحظة المعلمة</div>${esc(x.feedback)}</div></div>` : ''}${t.qs.map((q, i) => { const s = (x.scores || {})[q.id] || 0; return `<div class="stu-q"><div class="stu-qh"><b>${i + 1}. ${esc(q.text || QT[q.type])}</b><span class="badge ${s >= q.pts ? 'low' : s ? 'mid' : 'high'}">${fmt(s)} / ${fmt(q.pts)}</span></div><div class="small"><span class="muted">إجابتي: </span>${answerHtml(q, (x.answers || {})[q.id])}</div>${rightHtml(q) && s < q.pts ? `<div class="small" style="color:var(--ok)">الإجابة الصحيحة: ${rightHtml(q)}</div>` : ''}</div>`; }).join('')}` : App.empty('clock', 'سُلّمت المهمة', 'ستظهر درجتك هنا بعد أن تصححها المعلمة.')});
}


/* =====================================================================
   شاشة الدخول: معلمة أم طالب؟
   ===================================================================== */
const KROLE = 'teacherhub:role', KTA = 'teacherhub:tAuth';
const ss = {get(k) { try { return sessionStorage.getItem(k); } catch(e) { return App._ss && App._ss[k]; } }, set(k, v) { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch(e) { App._ss = App._ss || {}; App._ss[k] = v; } }};
const tAuth = () => { try { return JSON.parse(localStorage.getItem(KTA) || 'null'); } catch(e) { return null; } };
let gateEl = null, gateStep = 'pick';
function showGate(step) {
  gateStep = step || 'pick';
  if (!gateEl) { gateEl = document.createElement('div'); gateEl.id = 'gate'; document.getElementById('app').appendChild(gateEl); }
  document.body.style.overflow = 'hidden'; drawGate();
}
function hideGate() { if (gateEl) gateEl.remove(); gateEl = null; document.body.style.overflow = ''; }
function drawGate() {
  const ta = tAuth(); const prof = S.profile || {};
  const logo = `<div class="gate-logo"><span class="logo" aria-hidden="true"><svg viewBox="0 0 32 32"><rect x="3" y="5" width="26" height="22" rx="6" fill="currentColor" opacity=".16"/><path d="M9 12h14M9 17h9M9 22h5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" fill="none"/><circle cx="23" cy="21" r="4" fill="currentColor"/></svg></span><div><b>منظّم المعلم</b><span>ومركز إنجاز الطلاب</span></div></div>`;
  let inner;
  if (gateStep === 'pick') inner = `<h2>أهلًا بك</h2><p class="muted">اختر نوع حسابك للدخول.</p><div class="gate-pick"><button data-r="teacher"><span>${ic('book')}</span><b>معلم / معلمة</b><small>المهام والجداول والفصول والتصحيح</small></button><button data-r="student"><span>${ic('trophy')}</span><b>طالب / طالبة</b><small>مهامي ودرجاتي ورسائل المعلمة</small></button></div>`;
  else {
    const isNew = !ta;
    inner = `<button class="btn sm ghost gate-back" data-gb>${ic('right')}رجوع</button><h2>${isNew ? 'إنشاء حساب معلمة' : 'دخول المعلمة'}</h2><p class="muted">${isNew ? 'اختاري رقمًا سريًا من 4 أرقام لتدخلي به لاحقًا.' : 'اكتبي اسمك ورقمك السري.'}</p>
    <form id="gF" class="fgrid" style="grid-template-columns:1fr"><label class="f"><span>الاسم الكامل</span><input id="gN" value="${esc(isNew ? (prof.name || '') : '')}" autocomplete="off"></label><label class="f"><span>الرقم السري (4 أرقام)</span><input id="gP" inputmode="numeric" maxlength="4" dir="ltr" placeholder="••••"></label>${isNew ? '<label class="f"><span>أعيدي كتابة الرقم السري</span><input id="gP2" inputmode="numeric" maxlength="4" dir="ltr" placeholder="••••"></label>' : ''}<button class="btn primary" type="submit">${isNew ? 'إنشاء الحساب والدخول' : 'دخول'}</button></form>`;
  }
  gateEl.innerHTML = `<div class="gate-card card">${logo}${inner}</div>`;
  $$('[data-r]', gateEl).forEach(b => b.onclick = () => { if (b.dataset.r === 'student') { ss.set(KROLE, 'student'); hideGate(); openStudent(); } else if (!isTrial()) { ss.set(KROLE, 'teacher'); hideGate(); } else { gateStep = 'teacher'; drawGate(); } });
  const gb = $('[data-gb]', gateEl); if (gb) gb.onclick = () => { gateStep = 'pick'; drawGate(); };
  const f = $('#gF', gateEl); if (f) f.onsubmit = e => {
    e.preventDefault(); const name = $('#gN', gateEl).value.trim().replace(/\s+/g, ' '), pin = $('#gP', gateEl).value.trim();
    if (name.split(' ').length < 2) { App.toast('اكتبي اسمك الأول واسم الأب على الأقل', true); return; }
    if (!/^\d{4}$/.test(pin)) { App.toast('الرقم السري 4 أرقام', true); return; }
    const ta = tAuth();
    if (!ta) {
      if (pin !== $('#gP2', gateEl).value.trim()) { App.toast('الرقمان السريان غير متطابقين', true); return; }
      try { localStorage.setItem(KTA, JSON.stringify({name, pin})); } catch(e) {}
      if (!S.profile || !S.profile.name) setTimeout(() => { const n = document.getElementById('pfn'); if (n && !n.value) n.value = name; }, 50);
      App.toast('تم إنشاء حسابك');
    } else if (norm(ta.name) !== norm(name) || ta.pin !== pin) { App.toast('الاسم أو الرقم السري غير صحيح', true); return; }
    ss.set(KROLE, 'teacher'); hideGate(); App.render();
  };
  const first = $('input', gateEl); if (first && matchMedia('(min-width:700px)').matches) setTimeout(() => first.focus(), 30);
}
/* sign out returns to the entry screen */
const trialSignOut = async () => { if (!(await App.confirm('تسجيل الخروج؟', 'خروج', false))) return; ss.set(KROLE, null); closeStudent(true); showGate('pick'); };
const hasTeacherSession = () => { try { return Object.keys(localStorage).some(k => /^sb-.+-auth-token$/.test(k) && localStorage.getItem(k)); } catch(e) { return false; } };
function startGate() {
  if (/^#join-/i.test(location.hash || '')) { ss.set(KROLE, 'student'); return; }
  const r = ss.get(KROLE);
  if (r === 'student') return openStudent();
  if (r === 'teacher') return;
  if (!isTrial()) { if (/[?&]dev\b/.test(location.search) || hasTeacherSession()) return; if (curStu) { ss.set(KROLE, 'student'); return openStudent(); } }
  showGate('pick');
}
/* join links: #join-CODE */
function checkJoin() { const m = /^#join-([A-Za-z0-9]{4,8})$/.exec(location.hash || ''); if (!m) return; try { history.replaceState(null, '', location.pathname + location.search + '#achieve'); } catch(e) {} openStudent(m[1]); }
window.addEventListener('hashchange', checkJoin);
document.addEventListener('DOMContentLoaded', () => { startGate(); checkJoin(); if (isTrial()) App.signOut = trialSignOut; });
})();
