/* سجل متابعة الطلاب + إعلانات المدرسة (تظهر للمطور، وللمعلمات عند إتاحتها من لوحة المطور) */
'use strict';
(function(){
const {$, $$, esc, ic, D, S, Store} = App;

/* ---------- feature switches ---------- */
App.featureOn = k => !!(S.isOwner || ((S.config || {}).features || {})[k]);

/* =====================================================================
   إعلانات المدرسة
   ===================================================================== */
const anns = () => ((S.config || {}).announcements || []).slice().sort((a, b) => (b.at || 0) - (a.at || 0));
let myReads = null, loadingReads = false;
const LS_READS = 'teacherhub:annReads';
async function loadMyReads() {
  if (myReads || loadingReads) return; loadingReads = true;
  let ids = [];
  try { ids = JSON.parse(localStorage.getItem(LS_READS) || '[]'); } catch(e) {}
  if (Store.mode === 'cloud') {
    try { const {data, error} = await Store.sb.from('announcement_reads').select('ann_id').eq('user_id', S.uid); if (!error && data) ids = ids.concat(data.map(r => r.ann_id)); } catch(e) {}
  }
  myReads = new Set(ids); loadingReads = false; App.flush();
}
async function markAnnRead(id) {
  myReads = myReads || new Set(); myReads.add(id);
  try { localStorage.setItem(LS_READS, JSON.stringify([...myReads])); } catch(e) {}
  App.flush();
  if (Store.mode === 'cloud') { try { await Store.sb.from('announcement_reads').upsert({user_id: S.uid, ann_id: id}); } catch(e) {} }
}
/* strip shown at the top of the dashboard */
App.annStrip = () => {
  if (!App.featureOn('announcements')) return '';
  if (!myReads) { loadMyReads(); return ''; }
  const list = anns().filter(a => !myReads.has(a.id)).slice(0, 3);
  if (!list.length) return '';
  return `<div class="ann-strip">${list.map(a => `<div class="ann"><span class="ann-ic">${ic('bell')}</span><div style="flex:1;min-width:0"><div class="small muted">إعلان من الإدارة · ${esc(D.short(new Date(a.at)))}</div><b>${esc(a.title)}</b>${a.body ? `<div class="prose small" style="margin-top:4px">${esc(a.body)}</div>` : ''}</div><button class="btn sm primary" data-ann-read="${esc(a.id)}">تمت القراءة</button></div>`).join('')}</div>`;
};
App.bindAnn = el => { $$('[data-ann-read]', el).forEach(b => b.onclick = () => markAnnRead(b.dataset.annRead)); };

/* developer side */
let allReads = null;
async function loadAllReads() {
  if (Store.mode !== 'cloud') { allReads = []; App.flush(); return; }
  const {data, error} = await Store.sb.from('announcement_reads').select('user_id,ann_id,read_at').limit(5000);
  allReads = error ? [] : data; App._annErr = !!error; App.flush();
}
function teachers() { return (App.registry || []).filter(r => r.user_id !== S.uid); }
function annAdminCard() {
  if (allReads == null) loadAllReads();
  const list = anns(); const T = teachers();
  return `<div class="card" style="margin-bottom:16px"><h3>${ic('bell')}إعلانات المدرسة</h3>
    <p class="small muted" style="margin-top:0">يظهر الإعلان أعلى لوحة التحكم عند كل معلمة حتى تضغط «تمت القراءة»، وتعرفين من هنا من قرأته.${App._annErr ? ' <b style="color:var(--danger)">لم يُفعَّل تتبّع القراءة بعد: شغّلي كود إعداد الإعلانات في Supabase.</b>' : ''}</p>
    <div class="fgrid"><label class="f full"><span>عنوان الإعلان</span><input id="annT" maxlength="120" placeholder="مثال: اجتماع المعلمات يوم الأحد"></label>
    <label class="f full"><span>نص الإعلان (اختياري)</span><textarea id="annB" rows="3" placeholder="التفاصيل…"></textarea></label></div>
    <button class="btn primary" id="annPub" style="margin-top:12px">${ic('plus')}نشر الإعلان</button>
    ${list.length ? `<div class="items" style="margin-top:16px">${list.map(a => { const r = (allReads || []).filter(x => x.ann_id === a.id && x.user_id !== S.uid); return `<div class="item"><div class="body"><div class="t">${esc(a.title)}</div><div class="meta"><span>${esc(D.short(new Date(a.at)))}</span><span class="badge ${T.length && r.length >= T.length ? 'low' : 'acc'}">قرأته ${r.length} من ${T.length}</span></div></div><div class="acts"><button class="btn sm" data-ann-who="${esc(a.id)}">من قرأته؟</button><button class="icon-btn sm" data-ann-del="${esc(a.id)}" aria-label="حذف">${ic('trash')}</button></div></div>`; }).join('')}</div>` : '<p class="small muted">لم تُنشر إعلانات بعد.</p>'}</div>`;
}
function bindAnnAdmin(el) {
  const pub = $('#annPub', el); if (!pub) return;
  pub.onclick = async () => {
    const title = App.val(el, '#annT'); if (!title) { App.toast('اكتبي عنوان الإعلان', true); return; }
    const a = {id: App.rid(), title, body: App.val(el, '#annB'), at: Date.now()};
    await App.saveConfig({announcements: [a].concat((S.config.announcements || [])).slice(0, 30)});
    App.toast(App.featureOn('announcements') && ((S.config.features || {}).announcements) ? 'نُشر الإعلان للمعلمات' : 'نُشر الإعلان. لن تراه المعلمات حتى تفعّلي «إتاحة للمعلمات».');
  };
  $$('[data-ann-del]', el).forEach(b => b.onclick = async () => { if (!(await App.confirm('حذف هذا الإعلان؟'))) return; await App.saveConfig({announcements: (S.config.announcements || []).filter(a => a.id !== b.dataset.annDel)}); App.toast('حُذف الإعلان'); });
  $$('[data-ann-who]', el).forEach(b => b.onclick = () => {
    const a = anns().find(x => x.id === b.dataset.annWho); const T = teachers();
    const r = new Map((allReads || []).filter(x => x.ann_id === a.id).map(x => [x.user_id, x.read_at]));
    const read = T.filter(t => r.has(t.user_id)), unread = T.filter(t => !r.has(t.user_id));
    App.modal({title: 'من قرأت: ' + a.title, body: `<div class="section"><h4>قرأته (${read.length})</h4>${read.length ? `<div class="mini">${read.map(t => `<div class="m"><span class="t">${esc(t.name)}</span><span class="small muted">${esc(D.fmtDT(D.ymd(new Date(r.get(t.user_id))) + 'T' + D.hm(new Date(r.get(t.user_id)))))}</span></div>`).join('')}</div>` : '<p class="small muted">لا أحد بعد.</p>'}</div><div class="section"><h4>لم تقرأه بعد (${unread.length})</h4>${unread.length ? `<div class="mini">${unread.map(t => `<div class="m"><span class="t">${esc(t.name)}</span></div>`).join('')}</div>` : '<p class="small muted">قرأته جميع المعلمات.</p>'}</div>`, foot: false});
  });
}

/* feature switches card */
function featuresCard() {
  const f = S.config.features || {};
  const row = (k, t, d) => `<label class="item" style="cursor:pointer;align-items:center"><span class="body"><span class="t">${t}</span><span class="small muted" style="display:block">${d}</span></span><input type="checkbox" data-feat="${k}" ${f[k] ? 'checked' : ''} aria-label="إتاحة للمعلمات"></label>`;
  return `<div class="card" style="margin-bottom:16px"><h3>${ic('sliders')}مزايا تجريبية</h3><p class="small muted" style="margin-top:0">تظهر هذه المزايا لكِ وحدكِ. فعّلي المربع لإتاحة الميزة لجميع المعلمات.</p><div class="items">
    ${row('students', 'سجل متابعة الطلاب — إتاحة للمعلمات', 'الحضور والمشاركة والملاحظات لكل فصل، مع تقرير لولي الأمر.')}
    ${row('announcements', 'إعلانات المدرسة — إتاحة للمعلمات', 'إعلانات تظهر أعلى لوحة التحكم مع معرفة من قرأها.')}</div></div>`;
}
App.adminExtras = () => featuresCard() + annAdminCard();
App.bindAdminExtras = el => {
  $$('[data-feat]', el).forEach(c => c.onchange = async () => { const f = Object.assign({}, S.config.features || {}, {[c.dataset.feat]: c.checked}); await App.saveConfig({features: f}); App.toast(c.checked ? 'أصبحت الميزة متاحة للمعلمات' : 'أصبحت الميزة لكِ وحدكِ'); });
  bindAnnAdmin(el);
};

/* =====================================================================
   سجل متابعة الطلاب
   ===================================================================== */
const ATT = [['p', 'حاضر'], ['a', 'غائب'], ['l', 'متأخر'], ['e', 'مستأذن']];
App.ui.st = {cls: null, tab: 'day', date: D.ymd(new Date()), q: ''};
const classes = () => (S.sclasses || []).slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
const attOf = (cid, date) => (S.attend || []).find(r => r.cls === cid && r.date === date);
const attId = (cid, date) => cid + '_' + date.replace(/-/g, '');

async function saveAtt(cls, date, mut) {
  const cur = attOf(cls.id, date);
  const r = cur ? App.clone(cur) : {id: attId(cls.id, date), cls: cls.id, date, a: {}, p: {}, n: {}};
  r.a = r.a || {}; r.p = r.p || {}; r.n = r.n || {};
  mut(r); await Store.put('attend', r);
}
function editClass(cls) {
  const c = cls ? App.clone(cls) : {name: '', grade: '', students: []};
  App.modal({title: cls ? 'تعديل الفصل' : 'فصل جديد', wide: true, body: `<div class="fgrid">
    <label class="f"><span>اسم الفصل *</span><input id="cn" value="${esc(c.name)}" placeholder="مثال: 3/أ"></label>
    <label class="f"><span>الصف (اختياري)</span><input id="cg" value="${esc(c.grade || '')}" placeholder="مثال: الثالث الابتدائي"></label>
    ${c.students.length ? `<div class="f full"><span style="font-weight:600">الطلاب الحاليون (${c.students.length})</span><div class="items" id="cst">${c.students.map(s => `<div class="dr" data-sid="${esc(s.id)}" style="display:flex;gap:8px;align-items:center"><input type="text" value="${esc(s.name)}" aria-label="الاسم"><button type="button" class="icon-btn sm" data-rm aria-label="حذف">${ic('x')}</button></div>`).join('')}</div></div>` : ''}
    <label class="f full"><span>${c.students.length ? 'إضافة طلاب جدد' : 'أسماء الطلاب'} (اسم في كل سطر)</span><textarea id="cnew" rows="6" placeholder="نورة أحمد&#10;سارة محمد&#10;…"></textarea><span class="small muted" style="font-weight:400">يمكنك نسخ الأسماء من ملف Excel أو نور ولصقها هنا.</span></label></div>`,
  onMount(m) { const st = $('#cst', m); if (st) st.onclick = e => { const b = e.target.closest('[data-rm]'); if (b) b.closest('[data-sid]').remove(); }; },
  foot: [{label: 'حفظ', cls: 'primary', icon: 'check', async onClick(api) {
    const m = api.el; const name = App.val(m, '#cn'); if (!name) { App.toast('اكتبي اسم الفصل', true); return false; }
    const kept = $$('#cst [data-sid]', m).map(r => ({id: r.dataset.sid, name: $('input', r).value.trim()})).filter(s => s.name);
    const added = App.val(m, '#cnew').split(/\n+/).map(s => s.replace(/^[\d\s.\-–)]+/, '').trim()).filter(Boolean).map(name => ({id: App.rid(), name}));
    const saved = await Store.put('sclasses', Object.assign(c, {name, grade: App.val(m, '#cg'), students: kept.concat(added)}));
    App.ui.st.cls = saved.id; App.toast(cls ? 'تم حفظ الفصل' : 'تمت إضافة الفصل');
  }}, '|', ...(cls ? [{label: 'حذف الفصل', cls: 'ghost danger', icon: 'trash', async onClick() {
    if (!(await App.confirm('حذف هذا الفصل مع كل سجلات الحضور والمشاركة الخاصة به؟'))) return false;
    for (const r of (S.attend || []).filter(x => x.cls === cls.id)) await Store.del('attend', r.id);
    await Store.del('sclasses', cls.id); App.ui.st.cls = null; App.toast('تم حذف الفصل');
  }}] : [])]});
}
function stats(cls, sid) {
  const recs = (S.attend || []).filter(r => r.cls === cls.id);
  const o = {days: 0, p: 0, a: 0, l: 0, e: 0, part: 0, notes: [], absent: [], late: []};
  recs.forEach(r => {
    const st = (r.a || {})[sid]; if (st) { o.days++; o[st]++; if (st === 'a') o.absent.push(r.date); if (st === 'l') o.late.push(r.date); }
    o.part += +((r.p || {})[sid] || 0);
    if ((r.n || {})[sid]) o.notes.push({date: r.date, text: r.n[sid]});
  });
  o.rate = o.days ? Math.round((o.p + o.l) / o.days * 100) : null;
  o.notes.sort((a, b) => b.date.localeCompare(a.date)); o.absent.sort(); o.late.sort();
  return o;
}
const fdate = s => D.long(D.parse(s));
function studentReport(cls, s) {
  const o = stats(cls, s.id);
  const body = `<div class="stat-row" style="grid-template-columns:repeat(auto-fit,minmax(110px,1fr))"><div class="stat"><b>${o.rate == null ? '—' : o.rate + '%'}</b><span>نسبة الحضور</span></div><div class="stat ${o.a ? 'alert' : ''}"><b>${o.a}</b><span>أيام الغياب</span></div><div class="stat"><b>${o.l}</b><span>مرات التأخر</span></div><div class="stat"><b>${o.part}</b><span>نقاط المشاركة</span></div></div>
    ${o.absent.length ? `<div class="section"><h4>أيام الغياب</h4><div class="chips">${o.absent.map(d => `<span class="chip">${esc(D.short(D.parse(d)))}</span>`).join('')}</div></div>` : ''}
    ${o.late.length ? `<div class="section"><h4>أيام التأخر</h4><div class="chips">${o.late.map(d => `<span class="chip">${esc(D.short(D.parse(d)))}</span>`).join('')}</div></div>` : ''}
    <div class="section"><h4>الملاحظات (${o.notes.length})</h4>${o.notes.length ? `<div class="mini">${o.notes.map(n => `<div class="m" style="align-items:flex-start;cursor:default"><span class="badge">${esc(D.short(D.parse(n.date)))}</span><span style="flex:1;white-space:pre-wrap">${esc(n.text)}</span></div>`).join('')}</div>` : '<p class="small muted">لا توجد ملاحظات.</p>'}</div>`;
  App.modal({title: s.name, wide: true, body, foot: [{label: 'تقرير لولي الأمر', cls: 'primary', icon: 'printer', close: false, onClick() {
    const p = S.profile || {};
    const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير ${esc(s.name)}</title><style>body{font-family:"IBM Plex Sans Arabic",Tahoma,Arial,sans-serif;max-width:780px;margin:30px auto;padding:0 20px;color:#111;line-height:1.7}h1{margin:0 0 4px;color:#2f5bea}.k{display:flex;gap:12px;flex-wrap:wrap;margin:18px 0}.k div{border:1px solid #dde;border-radius:10px;padding:10px 16px;min-width:120px}.k b{display:block;font-size:24px}h3{margin:20px 0 6px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccd;padding:6px 8px;text-align:right}th{background:#eef1f8}.muted{color:#666}button{padding:8px 16px;font:inherit}@media print{button{display:none}}</style></head><body><button onclick="print()">طباعة / حفظ PDF</button><h1>تقرير متابعة الطالب</h1><p class="muted">${esc([p.school, cls.grade, 'الفصل ' + cls.name].filter(Boolean).join(' · '))}<br>المعلمة: ${esc(p.name || '')}${p.subject ? ' · المادة: ' + esc(p.subject) : ''} · تاريخ التقرير: ${esc(D.long(new Date()))}</p><h2 style="margin:10px 0">${esc(s.name)}</h2><div class="k"><div><b>${o.rate == null ? '—' : o.rate + '%'}</b>نسبة الحضور</div><div><b>${o.a}</b>أيام الغياب</div><div><b>${o.l}</b>مرات التأخر</div><div><b>${o.part}</b>نقاط المشاركة</div></div>${o.absent.length ? `<h3>أيام الغياب</h3><p>${o.absent.map(fdate).map(esc).join('، ')}</p>` : ''}${o.notes.length ? `<h3>ملاحظات المعلمة</h3><table><thead><tr><th style="width:30%">التاريخ</th><th>الملاحظة</th></tr></thead><tbody>${o.notes.map(n => `<tr><td>${esc(fdate(n.date))}</td><td>${esc(n.text)}</td></tr>`).join('')}</tbody></table>` : ''}<p class="muted" style="margin-top:30px">صدر هذا التقرير من منصة «منظّم المعلم».</p></body></html>`;
    App.save('تقرير-' + s.name.replace(/\s+/g, '-') + '.html', html);
  }}, '|', {label: 'حذف الطالب', cls: 'ghost danger', icon: 'trash', async onClick() { if (!(await App.confirm('حذف الطالب «' + s.name + '» من الفصل مع سجلاته؟'))) return false; await delStudent(cls, s.id); App.toast('تم حذف الطالب'); }}]});
}
async function delStudent(cls, sid) {
  for (const r of (S.attend || []).filter(x => x.cls === cls.id)) { const n = App.clone(r); ['a','p','n'].forEach(k => { if (n[k]) delete n[k][sid]; }); await Store.put('attend', n); }
  await Store.put('sclasses', Object.assign(App.clone(cls), {students: (cls.students || []).filter(x => x.id !== sid)}));
}
function noteModal(cls, s, date) {
  const cur = ((attOf(cls.id, date) || {}).n || {})[s.id] || '';
  App.modal({title: 'ملاحظة: ' + s.name, body: `<p class="small muted" style="margin-top:0">${esc(D.long(D.parse(date)))}</p><textarea id="sn" rows="4" placeholder="مثال: أجادت القراءة الجهرية اليوم">${esc(cur)}</textarea>`,
    foot: [{label: 'حفظ', cls: 'primary', async onClick(api) { const t = $('#sn', api.el).value.trim(); await saveAtt(cls, date, r => { if (t) r.n[s.id] = t; else delete r.n[s.id]; }); App.toast('تم حفظ الملاحظة'); }}]});
}

App.view('students', {title: 'سجل الطلاب', guard: () => App.featureOn('students'), render(el) {
  const u = App.ui.st; const list = classes();
  if (!list.length) { el.innerHTML = App.empty('list', 'لا توجد فصول بعد', 'أضيفي فصلك وأسماء طلابه، ثم سجّلي الحضور والمشاركة والملاحظات يوميًا، واطبعي تقريرًا لولي الأمر.', `<button class="btn primary" data-new>${ic('plus')}إضافة فصل</button>`); $('[data-new]', el).onclick = () => editClass(); return; }
  const cls = list.find(c => c.id === u.cls) || list[0]; u.cls = cls.id;
  const studs = (cls.students || []).filter(s => !u.q || s.name.includes(u.q.trim()));
  const rec = attOf(cls.id, u.date) || {a: {}, p: {}, n: {}};
  const marked = Object.keys(rec.a || {}).filter(k => (cls.students || []).some(s => s.id === k)).length;
  const head = `<div class="tabs">${list.map(c => `<button class="chip ${c.id === cls.id ? 'on' : ''}" data-cls="${esc(c.id)}">${esc(c.name)} <span class="muted">${(c.students || []).length}</span></button>`).join('')}<button class="chip" data-new>${ic('plus')}فصل جديد</button></div>
    <div class="toolbar"><div class="seg">${[['day', 'التسجيل اليومي', 'check'], ['sum', 'الملخص والتقارير', 'list']].map(([k, l, i]) => `<button data-tab="${k}" class="${u.tab === k ? 'on' : ''}">${ic(i)}${l}</button>`).join('')}</div><div class="search grow">${ic('search')}<input id="sq" placeholder="ابحثي باسم الطالب" value="${esc(u.q)}"></div><button class="btn sm" data-edit>${ic('edit')}الفصل والطلاب</button></div>`;
  let body = '';
  if (!(cls.students || []).length) body = App.empty('user', 'لا يوجد طلاب في هذا الفصل', 'أضيفي أسماء الطلاب من زر «الفصل والطلاب».', `<button class="btn primary" data-edit>${ic('plus')}إضافة الطلاب</button>`);
  else if (u.tab === 'day') {
    body = `<div class="toolbar"><label class="row" style="gap:8px"><span class="small muted">اليوم:</span><input type="date" id="sd" value="${esc(u.date)}" style="width:auto"></label><span class="small muted grow">${esc(D.long(D.parse(u.date)))} · سُجّل ${marked} من ${(cls.students || []).length}</span><button class="btn sm" data-allp>${ic('check')}الجميع حاضر</button>${attOf(cls.id, u.date) ? `<button class="btn sm ghost danger" data-clrday>${ic('trash')}مسح تسجيل هذا اليوم</button>` : ''}</div>
    <div class="items">${studs.map(s => { const a = (rec.a || {})[s.id], pt = +((rec.p || {})[s.id] || 0), nt = (rec.n || {})[s.id];
      return `<div class="item st-row" data-sid="${esc(s.id)}"><div class="body" style="cursor:default"><div class="t">${esc(s.name)}</div>${nt ? `<div class="small muted" style="margin-top:2px;white-space:pre-wrap">${ic('note')} ${esc(nt)}</div>` : ''}</div>
      <div class="st-ctl"><div class="seg att">${ATT.map(([k, l]) => `<button data-att="${k}" class="${a === k ? 'on ' + k : ''}">${l}</button>`).join('')}</div>
      <div class="pts"><button class="icon-btn sm" data-pt="-1" aria-label="إنقاص المشاركة">−</button><span title="نقاط المشاركة">${ic('star')}<b>${pt}</b></span><button class="icon-btn sm" data-pt="1" aria-label="زيادة المشاركة">+</button></div>
      <button class="icon-btn sm" data-note aria-label="ملاحظة">${ic('note')}</button><button class="icon-btn sm" data-delst aria-label="حذف الطالب" title="حذف الطالب">${ic('trash')}</button></div></div>`; }).join('')}</div>`;
  } else {
    const rows = studs.map(s => Object.assign({s}, stats(cls, s.id)));
    body = `<p class="small muted">اضغطي اسم الطالب لعرض سجله الكامل وطباعة تقرير لولي الأمر.</p><div class="tbl-wrap"><table class="data stack"><thead><tr><th>الطالب</th><th>نسبة الحضور</th><th>الغياب</th><th>التأخر</th><th>المشاركة</th><th>الملاحظات</th></tr></thead><tbody>${rows.map(r => `<tr data-rep="${esc(r.s.id)}" style="cursor:pointer"><td data-l="الطالب"><b>${esc(r.s.name)}</b></td><td class="n" data-l="نسبة الحضور">${r.rate == null ? '—' : r.rate + '%'}</td><td class="n" data-l="الغياب">${r.a ? `<span class="badge high">${r.a}</span>` : 0}</td><td class="n" data-l="التأخر">${r.l}</td><td class="n" data-l="المشاركة">${r.part}</td><td class="n" data-l="الملاحظات">${r.notes.length}</td></tr>`).join('')}</tbody></table></div>`;
  }
  el.innerHTML = head + body;
  $$('[data-cls]', el).forEach(b => b.onclick = () => { u.cls = b.dataset.cls; App.render(); });
  $$('[data-new]', el).forEach(b => b.onclick = () => editClass());
  $$('[data-edit]', el).forEach(b => b.onclick = () => editClass(cls));
  $$('[data-tab]', el).forEach(b => b.onclick = () => { u.tab = b.dataset.tab; App.render(); });
  const sq = $('#sq', el); if (sq) sq.oninput = App.debounce(() => { u.q = sq.value; App.render(); }, 250);
  const sd = $('#sd', el); if (sd) sd.onchange = () => { if (sd.value) { u.date = sd.value; App.render(); } };
  const allp = $('[data-allp]', el); if (allp) allp.onclick = () => saveAtt(cls, u.date, r => (cls.students || []).forEach(s => { if (!r.a[s.id]) r.a[s.id] = 'p'; }));
  const clr = $('[data-clrday]', el); if (clr) clr.onclick = async () => { if (!(await App.confirm('مسح الحضور والمشاركة والملاحظات المسجلة في هذا اليوم لهذا الفصل؟'))) return; await Store.del('attend', attOf(cls.id, u.date).id); App.toast('تم مسح تسجيل اليوم'); };
  $$('.st-row', el).forEach(row => {
    const sid = row.dataset.sid; const s = cls.students.find(x => x.id === sid);
    $$('[data-att]', row).forEach(b => b.onclick = () => saveAtt(cls, u.date, r => { if (r.a[sid] === b.dataset.att) delete r.a[sid]; else r.a[sid] = b.dataset.att; }));
    $$('[data-pt]', row).forEach(b => b.onclick = () => saveAtt(cls, u.date, r => { r.p[sid] = Math.max(0, +(r.p[sid] || 0) + +b.dataset.pt); }));
    $('[data-note]', row).onclick = () => noteModal(cls, s, u.date);
    $('[data-delst]', row).onclick = async () => { if (!(await App.confirm('حذف الطالب «' + s.name + '» من الفصل مع سجلاته؟'))) return; await delStudent(cls, sid); App.toast('تم حذف الطالب'); };
  });
  $$('[data-rep]', el).forEach(tr => tr.onclick = () => studentReport(cls, cls.students.find(x => x.id === tr.dataset.rep)));
}});
})();
