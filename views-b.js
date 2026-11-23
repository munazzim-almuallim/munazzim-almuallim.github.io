/* التقويم + الجداول + الخطط */
'use strict';
(function(){
const {$, $$, esc, ic, D, K, S, Store} = App;

/* ================= Events & Calendar ================= */
App.editEvent = (ev, preset={}) => {
  const e = Object.assign({title:'', type:'school', date:D.ymd(new Date()), start:'', end:'', taskId:'', remind:60, notes:''}, preset, ev || {});
  App.modal({title: ev ? 'تعديل الموعد' : 'موعد أو حدث جديد', body:`<div class="fgrid">
    <label class="f full"><span>العنوان *</span><input id="et" value="${esc(e.title)}" placeholder="مثال: اجتماع أولياء الأمور"></label>
    <label class="f"><span>النوع</span><select id="ey">${App.opts(K.EV, e.type)}</select></label>
    <label class="f"><span>التاريخ</span><input type="date" id="ed" value="${esc(e.date)}"></label>
    <label class="f"><span>من الساعة</span><input type="time" id="es" value="${esc(e.start)}"></label>
    <label class="f"><span>إلى الساعة</span><input type="time" id="ee" value="${esc(e.end)}"></label>
    <label class="f"><span>ربط بمهمة</span><select id="ek"><option value="">بدون</option>${App.opts(S.tasks.filter(t => t.status !== 'done' || t.id === e.taskId).map(t => [t.id, t.title]), e.taskId)}</select></label>
    <div>${App.remindField(e.remind, 'er')}</div>
    <label class="f full"><span>ملاحظات</span><textarea id="en" rows="3">${esc(e.notes)}</textarea></label></div>`,
  onMount(m) { App.bindRemind(m, 'er'); },
  foot:[{label:'حفظ', cls:'primary', icon:'check', async onClick(api) {
    const m = api.el; const title = App.val(m, '#et'); const date = App.val(m, '#ed');
    if (!title || !date) { App.toast('العنوان والتاريخ مطلوبان', true); return false; }
    const s = App.val(m, '#es'), en = App.val(m, '#ee'); if (s && en && en < s) { App.toast('وقت النهاية قبل وقت البداية', true); return false; }
    await Store.put('events', Object.assign({}, e, {title, type: $('#ey', m).value, date, start: s, end: en, taskId: $('#ek', m).value, remind: App.readRemind(m, 'er'), notes: App.val(m, '#en')}));
    App.toast(ev ? 'تم تحديث الموعد' : 'تمت إضافة الموعد');
  }}, '|', ...(ev ? [{label:'حذف', cls:'ghost danger', icon:'trash', async onClick() { if (!(await App.confirm('حذف هذا الموعد؟'))) return false; await Store.del('events', ev.id); App.toast('تم الحذف'); }}] : [])]});
};
const evCls = t => t === 'exam' ? 'exam' : t === 'meet' ? 'meet' : '';
const dayItems = d => {
  const ev = S.events.filter(e => e.date === D.ymd(d)).sort((a, b) => (a.start || '').localeCompare(b.start || ''));
  const tk = S.tasks.filter(t => t.due && D.sameDay(D.parse(t.due), d));
  return {ev, tk};
};
/* حصص الجدول الرئيسي تظهر في التقويم */
const lessonsOf = d => {
  const sc = S.schedules.find(s => s.main && s.kind === 'classes') || S.schedules.find(s => s.kind === 'classes'); if (!sc) return [];
  const dow = d.getDay(); if (!(sc.days || [0,1,2,3,4]).includes(dow)) return [];
  return (sc.periods || []).map((p, i) => ({p, i, c: (sc.cells || {})[dow + '-' + i]})).filter(x => x.c && x.c.subject);
};
const nLessons = n => n === 1 ? 'حصة واحدة' : n === 2 ? 'حصتان' : n <= 10 ? n + ' حصص' : n + ' حصة';
const lessonChips = (d, compact) => { const L = lessonsOf(d); if (!L.length) return [];
  if (compact) return [`<div class="ev lesson" data-lessons title="${esc(L.map(x => 'الحصة ' + (x.i + 1) + ': ' + x.c.subject + (x.c.section ? ' ' + x.c.section : '')).join('، '))}">${nLessons(L.length)}</div>`];
  return L.map(x => `<div class="ev lesson" data-lessons title="${esc(x.c.subject)}">${esc(D.time12(x.p.start))} · الحصة ${x.i + 1}: ${esc(x.c.subject)}${x.c.section ? ' ' + esc(x.c.section) : ''}</div>`); };
const chipsFor = d => { const {ev, tk} = dayItems(d); return lessonChips(d, App.ui.cal.mode === 'month').concat(ev.map(e => `<div class="ev ${evCls(e.type)}" data-ev="${e.id}" title="${esc(e.title)}">${e.start ? esc(e.start) + ' ' : ''}${esc(e.title)}</div>`).concat(tk.map(t => `<div class="ev task ${t.status === 'done' ? 'done' : ''}" data-tk="${t.id}" title="${esc(t.title)}">${esc(t.title)}</div>`)).concat(App.calExtra ? App.calExtra(d) : [])); };
App.view('calendar', {title:'التقويم', render(el) {
  const u = App.ui.cal; const d = u.d;
  const head = `<div class="toolbar"><div class="seg">${[['day','يومي'],['week','أسبوعي'],['month','شهري']].map(([k, l]) => `<button data-cm="${k}" class="${u.mode === k ? 'on' : ''}">${l}</button>`).join('')}</div><span class="grow"></span><div class="row wrap small muted" style="gap:12px"><span><span class="ev" style="display:inline-block;padding:0 8px">موعد</span></span><span><span class="ev exam" style="display:inline-block;padding:0 8px">اختبار</span></span><span><span class="ev meet" style="display:inline-block;padding:0 8px">اجتماع</span></span><span><span class="ev task" style="display:inline-block;padding:0 8px">مهمة</span></span></div><button class="btn primary" id="addE">${ic('plus')}موعد جديد</button></div>`;
  let body = '';
  if (u.mode === 'month') body = App.monthGrid(d, chipsFor, 'cm');
  else if (u.mode === 'week') {
    const s = D.startWeek(d); const today = new Date();
    body = `<div class="cal-head"><h2>${esc(D.short(s))} – ${esc(D.short(D.addDays(s, 6)))}</h2><button class="icon-btn" data-nav="-7" aria-label="السابق">${ic('right')}</button><button class="btn sm" data-nav="0">اليوم</button><button class="icon-btn" data-nav="7" aria-label="التالي">${ic('left')}</button></div><div class="week">${[0,1,2,3,4,5,6].map(i => { const x = D.addDays(s, i); return `<div class="wd ${D.sameDay(x, today) ? 'today' : ''}" data-day="${D.ymd(x)}"><h5><span>${D.DAYS[i]}</span><span class="muted">${x.getDate()}</span></h5>${chipsFor(x).join('')}</div>`; }).join('')}</div>`;
  } else {
    const {ev, tk} = dayItems(d);
    const cx = lessonChips(d, false).concat(App.calExtra ? App.calExtra(d) : []);
    body = `<div class="cal-head"><h2>${esc(D.long(d))}<div class="small muted" style="font-weight:500">${esc(D.hijri(d))}</div></h2><button class="icon-btn" data-nav="-1" aria-label="السابق">${ic('right')}</button><button class="btn sm" data-nav="0">اليوم</button><button class="icon-btn" data-nav="1" aria-label="التالي">${ic('left')}</button></div>
    <div class="card dayview">${cx.length ? `<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:10px">${cx.join('')}</div>` : ''}${ev.length || tk.length ? ev.map(e => `<div class="slot"><span class="h">${e.start ? D.time12(e.start) : 'طوال اليوم'}</span><div><div class="ev ${evCls(e.type)}" data-ev="${e.id}" style="font-size:14px;padding:6px 10px;white-space:normal">${esc(e.title)} <span class="muted small">· ${K.EV[e.type] || ''}${e.end ? ' · حتى ' + D.time12(e.end) : ''}</span></div>${e.notes ? `<div class="small muted" style="margin-top:4px">${esc(e.notes)}</div>` : ''}</div></div>`).join('') + tk.map(t => `<div class="slot"><span class="h">${D.time12(D.hm(D.parse(t.due)))}</span><div><div class="ev task ${t.status === 'done' ? 'done' : ''}" data-tk="${t.id}" style="font-size:14px;padding:6px 10px;white-space:normal">مهمة: ${esc(t.title)}</div></div></div>`).join('') : App.empty('cal', 'يوم خالٍ', 'لا مواعيد أو مهام في هذا اليوم.', `<button class="btn primary" data-addday>${ic('plus')}إضافة موعد</button>`)}</div>`;
  }
  el.innerHTML = head + body;
  $$('[data-cm]', el).forEach(b => b.onclick = () => { u.mode = b.dataset.cm; App.render(); });
  $('#addE', el).onclick = () => App.editEvent(null, {date: D.ymd(u.mode === 'month' ? new Date() : d)});
  const ad = $('[data-addday]', el); if (ad) ad.onclick = () => App.editEvent(null, {date: D.ymd(d)});
  if (u.mode === 'month') App.bindMonth(el, 'cm', u, 'd', () => App.render(), x => { u.d = x; u.mode = 'day'; App.render(); });
  $$('[data-nav]', el).forEach(b => b.onclick = () => { const n = +b.dataset.nav; u.d = n ? D.addDays(d, n) : new Date(); App.render(); });
  if (u.mode === 'week') $$('.wd', el).forEach(c => c.onclick = e => { if (e.target.closest('.ev')) return; u.d = D.parse(c.dataset.day); u.mode = 'day'; App.render(); });
  $$('[data-ev]', el).forEach(x => x.onclick = e => { e.stopPropagation(); App.editEvent(S.events.find(v => v.id === x.dataset.ev)); });
  $$('[data-tk]', el).forEach(x => x.onclick = e => { e.stopPropagation(); App.showTask(x.dataset.tk); });
  $$('[data-ctk]', el).forEach(x => x.onclick = e => { e.stopPropagation(); App.openClassTask(x.dataset.ctk); });
  $$('[data-lessons]', el).forEach(x => x.onclick = e => { e.stopPropagation(); location.hash = 'schedules'; });
}});

/* ================= Schedules ================= */
const SK = {classes:'جدول الحصص', duty:'جدول المناوبة', meetings:'جدول الاجتماعات', other:'جدول آخر'};
const defPeriods = () => [['07:00','07:45'],['07:45','08:30'],['08:30','09:15'],['09:35','10:20'],['10:20','11:05'],['11:05','11:50'],['11:50','12:35']].map(([start, end]) => ({start, end}));
App.ui.sched = {sel: null};
App.schedInfo = () => {
  const sc = S.schedules.find(s => s.main && s.kind === 'classes') || S.schedules.find(s => s.kind === 'classes'); if (!sc) return null;
  const now = new Date(); const dow = now.getDay(); const nm = now.getHours() * 60 + now.getMinutes();
  const days = sc.days || [0,1,2,3,4];
  const today = [];
  if (days.includes(dow)) (sc.periods || []).forEach((p, i) => {
    const cell = (sc.cells || {})[dow + '-' + i]; if (!cell || !cell.subject) return;
    const s = D.mins(p.start), e = D.mins(p.end);
    today.push({n: i + 1, i, start: p.start, end: p.end, cell, state: nm >= e ? 'past' : nm >= s ? 'now' : 'later', ms: (s - nm) * 60000 - now.getSeconds() * 1000});
  });
  const nx = today.find(x => x.state === 'later'); if (nx) nx.state = 'next';
  let nextDay = '';
  if (!today.length) for (let k = 1; k <= 7; k++) { const dd = (dow + k) % 7; if (days.includes(dd) && Object.keys(sc.cells || {}).some(c => c.startsWith(dd + '-'))) { nextDay = D.DAYS[dd]; break; } }
  return {sc, today: today.filter(x => x.state !== 'past'), all: today, nextDay};
};
const editSchedule = sc => {
  const s = Object.assign({name:'', kind:'classes', term:'', days:[0,1,2,3,4], periods: defPeriods(), cells:{}, att:[], main: !S.schedules.some(x => x.main)}, sc || {});
  const perRow = (p, i) => `<div class="p"><b class="muted">${i + 1}</b><input type="time" value="${esc(p.start)}" aria-label="بداية"><input type="time" value="${esc(p.end)}" aria-label="نهاية"><button type="button" class="icon-btn sm" data-rmp aria-label="حذف الحصة">${ic('x')}</button></div>`;
  App.modal({title: sc ? 'إعدادات الجدول' : 'جدول جديد', wide:true, body:`${sc ? '' : `<div class="bn info" style="display:flex;gap:10px;align-items:flex-start;padding:10px 14px;border-radius:10px;background:var(--accent-soft);margin-bottom:16px;font-size:14px">${ic('info')}<span>هل لديكِ جدول جاهز بصيغة صورة أو PDF؟ اكتبي اسم الجدول وارفعيه من خانة «رفع صورة أو PDF للجدول» أدناه، ثم اضغطي «حفظ». ويمكنكِ بعد الحفظ تعبئة الحصص يدويًا بالضغط على خانات الجدول.</span></div>`}<div class="fgrid">
    <label class="f"><span>اسم الجدول *</span><input id="sn" value="${esc(s.name)}" placeholder="مثال: جدول الفصل الدراسي الأول"></label>
    <label class="f"><span>نوع الجدول</span><select id="sk">${App.opts(SK, s.kind)}</select></label>
    <label class="f"><span>الفصل الدراسي</span><input id="st" value="${esc(s.term)}" placeholder="الفصل الدراسي الأول 1448هـ"></label>
    <label class="f" style="justify-content:flex-end"><span class="row"><input type="checkbox" id="sm" ${s.main ? 'checked' : ''}> الجدول الرئيسي (يظهر في لوحة التحكم)</span></label>
    <div class="f full"><span style="font-weight:600">رفع صورة أو PDF للجدول (اختياري)</span>${App.attField(s.att)}</div>
    <div class="f full"><span style="font-weight:600">أيام الدوام</span><div class="chips" id="sdays">${D.DAYS.map((d, i) => `<button type="button" class="chip ${s.days.includes(i) ? 'on' : ''}" data-d="${i}">${d}</button>`).join('')}</div></div>
    <div class="f full"><span style="font-weight:600">الحصص وأوقاتها</span><div class="periods" id="sper">${s.periods.map(perRow).join('')}</div><button type="button" class="btn sm ghost" id="addp" style="align-self:flex-start">${ic('plus')}إضافة حصة</button></div></div>`,
  onMount(m) {
    App.bindAtt(m, 'الجداول الدراسية');
    const att = $('.att', m); $('[data-att-input]', att).setAttribute('accept', 'image/*,application/pdf'); $('[data-att-up]', att).innerHTML = ic('upload') + 'رفع صورة أو PDF';
    $('#sdays', m).onclick = e => { const b = e.target.closest('[data-d]'); if (b) b.classList.toggle('on'); };
    $('#addp', m).onclick = () => { const rows = $$('#sper .p', m); const last = rows.length ? $$('input', rows[rows.length - 1])[1].value : '07:00'; const st = last || '07:00'; const mm = D.mins(st) + 45; $('#sper', m).insertAdjacentHTML('beforeend', perRow({start: st, end: `${App.pad(Math.floor(mm / 60) % 24)}:${App.pad(mm % 60)}`}, rows.length)); };
    $('#sper', m).onclick = e => { if (e.target.closest('[data-rmp]')) { e.target.closest('.p').remove(); $$('#sper .p b', m).forEach((b, i) => b.textContent = i + 1); } };
  },
  foot:[{label:'حفظ', cls:'primary', icon:'check', async onClick(api) {
    const m = api.el; const name = App.val(m, '#sn'); if (!name) { App.toast('اكتبي اسم الجدول', true); return false; }
    const days = $$('#sdays .on', m).map(b => +b.dataset.d); if (!days.length) { App.toast('اختاري يومًا واحدًا على الأقل', true); return false; }
    const periods = $$('#sper .p', m).map(r => { const [a, b] = $$('input', r); return {start: a.value, end: b.value}; });
    if (!periods.length) { App.toast('أضيفي حصة واحدة على الأقل', true); return false; }
    const n = Object.assign({}, s, {name, kind: $('#sk', m).value, term: App.val(m, '#st'), days, periods, main: $('#sm', m).checked, att: App.readAtt(m)});
    if (n.main) for (const o of S.schedules.filter(x => x.main && x.id !== n.id)) await Store.put('schedules', Object.assign({}, o, {main: false}));
    const saved = await Store.put('schedules', n); App.ui.sched.sel = saved.id; App.toast(sc ? 'تم حفظ الجدول' : 'تم إنشاء الجدول. اضغطي أي خانة لإضافة حصة');
    const newAtt = (n.att || []).filter(x => !(s.att || []).includes(x) || !sc).map(x => S.files.find(f => f.id === x)).find(f => f && (f.kind === 'img' || f.kind === 'pdf'));
    if (newAtt && App.Fill && !Object.keys(n.cells || {}).length) setTimeout(() => App.Fill.auto(saved.id, newAtt), 300);
  }}, '|', ...(sc ? [{label:'حذف الجدول', cls:'ghost danger', icon:'trash', async onClick() { if (!(await App.confirm('حذف هذا الجدول بكل حصصه؟'))) return false; await Store.del('schedules', sc.id); App.ui.sched.sel = null; App.toast('تم الحذف'); }}] : [])]});
};
const editCell = (sc, d, p) => {
  const key = d + '-' + p; const c = Object.assign({subject:'', grade:'', section:'', note:''}, (sc.cells || {})[key]);
  const isClass = sc.kind === 'classes';
  App.modal({title:`${D.DAYS[d]} · الحصة ${p + 1} (${D.time12(sc.periods[p].start)})`, body:`<div class="fgrid">
    <label class="f full"><span>${isClass ? 'اسم المادة' : 'العنوان / المهمة'}</span><input id="cs" value="${esc(c.subject)}" list="subjList" placeholder="${isClass ? 'مثال: لغتي' : 'مثال: مناوبة الساحة'}"><datalist id="subjList">${[...new Set(Object.values(sc.cells || {}).map(x => x.subject).concat((S.profile || {}).subject || '').filter(Boolean))].map(x => `<option value="${esc(x)}">`).join('')}</datalist></label>
    <label class="f"><span>${isClass ? 'الصف' : 'المكان'}</span><input id="cg" value="${esc(c.grade)}" placeholder="${isClass ? 'الثالث الابتدائي' : ''}"></label>
    <label class="f"><span>${isClass ? 'الفصل' : 'مع'}</span><input id="cc" value="${esc(c.section)}" placeholder="${isClass ? '3/أ' : ''}"></label>
    <label class="f full"><span>ملاحظات الحصة</span><textarea id="cn" rows="3" placeholder="مثال: إحضار بطاقات الكلمات">${esc(c.note)}</textarea></label></div>`,
  foot:[{label:'حفظ', cls:'primary', async onClick(api) {
    const m = api.el; const cells = Object.assign({}, sc.cells || {});
    const v = {subject: App.val(m, '#cs'), grade: App.val(m, '#cg'), section: App.val(m, '#cc'), note: App.val(m, '#cn')};
    if (!v.subject && !v.grade && !v.note) delete cells[key]; else cells[key] = v;
    await Store.put('schedules', Object.assign({}, sc, {cells}));
  }}, {label:'نسخ إلى كل الأيام', cls:'', async onClick(api) {
    const m = api.el; const cells = Object.assign({}, sc.cells || {});
    const v = {subject: App.val(m, '#cs'), grade: App.val(m, '#cg'), section: App.val(m, '#cc'), note: App.val(m, '#cn')};
    if (!v.subject) { App.toast('اكتبي اسم المادة أولًا', true); return false; }
    (sc.days || []).forEach(dd => cells[dd + '-' + p] = Object.assign({}, v)); await Store.put('schedules', Object.assign({}, sc, {cells})); App.toast('تم النسخ إلى كل الأيام');
  }}, '|', {label:'تفريغ', cls:'ghost danger', async onClick() { const cells = Object.assign({}, sc.cells || {}); delete cells[key]; await Store.put('schedules', Object.assign({}, sc, {cells})); }}]});
};
const ttHTML = (sc, live) => {
  const info = live ? App.schedInfo() : null; const isMainLive = info && info.sc.id === sc.id; const dow = new Date().getDay();
  const days = (sc.days || []).slice().sort((a, b) => a - b);
  return `<table class="tt"><thead><tr><th>اليوم</th>${(sc.periods || []).map((p, i) => `<th>الحصة ${i + 1}<small>${D.time12(p.start)} – ${D.time12(p.end)}</small></th>`).join('')}</tr></thead><tbody>${days.map(d => `<tr class="${d === dow ? 'today' : ''}"><th>${D.DAYS[d]}</th>${(sc.periods || []).map((p, i) => { const c = (sc.cells || {})[d + '-' + i]; let cls = '';
    if (isMainLive && d === dow) { const x = info.all.find(y => y.i === i); if (x) cls = x.state === 'now' ? 'now' : x.state === 'next' ? 'next' : ''; }
    return `<td class="${cls}" data-cell="${d}-${i}" title="${c && c.note ? esc(c.note) : ''}">${c ? `<b>${esc(c.subject)}</b><small>${esc([c.grade, c.section].filter(Boolean).join(' · '))}</small>${c.note ? '<span class="nt" aria-label="ملاحظة"></span>' : ''}` : (live ? '<small style="opacity:.5">+</small>' : '')}</td>`; }).join('')}</tr>`).join('')}</tbody></table>`;
};
const exportSchedule = sc => {
  const p = S.profile || {};
  const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(sc.name)}</title><style>body{font-family:"IBM Plex Sans Arabic",Tahoma,Arial,sans-serif;margin:28px;color:#111}h1{font-size:22px;margin:0 0 4px}p{margin:0 0 16px;color:#555}table{border-collapse:collapse;width:100%}th,td{border:1px solid #999;padding:8px;text-align:center;font-size:13px}thead th{background:#eef1f6}tbody th{background:#f6f7f9}td b{display:block}td small{color:#555}.nt{display:none}button{margin-bottom:14px;padding:8px 16px;font:inherit}@media print{button{display:none}body{margin:10mm}}@page{size:landscape}</style></head><body><button onclick="print()">طباعة</button><h1>${esc(sc.name)}</h1><p>${esc([p.name, p.school, sc.term].filter(Boolean).join(' · '))}</p>${ttHTML(sc, false)}</body></html>`;
  App.modal({title:'طباعة وتنزيل الجدول', body:`<p style="margin-top:0">اختاري الصيغة المناسبة:</p><div class="quick"><button data-f="html">${ic('printer')}صفحة جاهزة للطباعة (HTML)</button><button data-f="csv">${ic('download')}جدول بيانات (CSV)</button></div><p class="small muted">افتحي ملف HTML في المتصفح واضغطي «طباعة» أو احفظيه PDF.</p>`, foot:false, onMount(m, api) {
    $$('[data-f]', m).forEach(b => b.onclick = () => {
      if (b.dataset.f === 'html') App.save(sc.name + '.html', html);
      else { const rows = [['اليوم'].concat(sc.periods.map((x, i) => `الحصة ${i + 1} (${x.start}-${x.end})`))].concat((sc.days || []).map(d => [D.DAYS[d]].concat(sc.periods.map((x, i) => { const c = (sc.cells || {})[d + '-' + i]; return c ? [c.subject, c.grade, c.section].filter(Boolean).join(' - ') : ''; }))));
        App.save(sc.name + '.csv', '﻿' + rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n')); }
      api.close();
    });
  }});
};
App.view('schedules', {title:'الجداول الدراسية', render(el) {
  const u = App.ui.sched; let sc = S.schedules.find(s => s.id === u.sel) || S.schedules.find(s => s.main) || S.schedules[0];
  if (!sc) { el.innerHTML = App.empty('grid', 'لا توجد جداول بعد', 'أنشئي جدول الحصص الأسبوعي يدويًا، أو ارفعي صورة/PDF لجدولك وجدول الفصل الدراسي.', `<button class="btn primary" data-new>${ic('plus')}إنشاء جدول</button>`); $('[data-new]', el).onclick = () => editSchedule(); return; }
  u.sel = sc.id;
  const info = App.schedInfo(); const live = info && info.sc.id === sc.id;
  const cur = live && info.today.find(x => x.state === 'now'), nxt = live && info.today.find(x => x.state === 'next');
  const att = (sc.att || []).map(id => S.files.find(f => f.id === id)).filter(Boolean);
  const noCells = !Object.keys(sc.cells || {}).length;
  const ATT = att.length ? `<div class="section" style="margin:6px 0 18px"><h4>الجداول المرفوعة</h4><div class="grid ${noCells ? '' : 'cols-auto'}">${att.map(f => `<div class="card att-view"><div class="row between" style="margin-bottom:10px"><b class="small" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(f.name)}</b><div class="row" style="gap:2px"><button class="icon-btn sm" data-open-file="${f.id}" aria-label="عرض">${ic('eye')}</button><button class="icon-btn sm" data-dl="${f.id}" aria-label="تنزيل">${ic('download')}</button><button class="icon-btn sm" data-unatt="${f.id}" aria-label="إزالة">${ic('x')}</button></div></div><div data-thumb="${f.id}" class="fthumb" style="${noCells ? 'height:auto;min-height:200px' : 'height:200px'}">${f.kind === 'pdf' ? '<span class="ficon pdf">PDF</span>' : ''}</div></div>`).join('')}</div></div>` : '';
  el.innerHTML = `
  <div class="tabs">${S.schedules.slice().sort((a, b) => (b.main - a.main) || (a.createdAt - b.createdAt)).map(s => `<button class="chip ${s.id === sc.id ? 'on' : ''}" data-sel="${s.id}">${s.main ? ic('star') : ''}${esc(s.name)}</button>`).join('')}<button class="chip" data-new>${ic('plus')}جدول جديد</button></div>
  <div class="toolbar"><div style="flex:1 1 220px"><h2 style="margin:0;font-size:20px">${esc(sc.name)}</h2><div class="small muted">${esc(SK[sc.kind] || '')}${sc.term ? ' · ' + esc(sc.term) : ''}${sc.main ? ' · الجدول الرئيسي' : ''}</div></div>
    <button class="btn sm" data-edit>${ic('sliders')}الإعدادات والأوقات</button>${App.Fill && App.Fill.available() ? `<button class="btn sm primary" data-fill>${ic('spark')}${App.Fill.label(App.Fill.available())}</button>` : ''}<button class="btn sm" data-up>${ic('upload')}رفع صورة/PDF</button><button class="btn sm" data-exp>${ic('printer')}طباعة وتنزيل</button>${!sc.main ? `<button class="btn sm ghost" data-main>${ic('star')}تعيين رئيسي</button>` : ''}<input type="file" accept="image/*,application/pdf" hidden id="schFile" multiple></div>
  ${live && (cur || nxt) ? `<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));margin-bottom:14px">${cur ? `<div class="next-class" style="margin:0;background:var(--accent);color:var(--accent-ink)"><span class="n" style="color:inherit">${cur.n}</span><div><b>الآن: ${esc(cur.cell.subject)}</b><div class="small" style="opacity:.85">تنتهي ${D.time12(cur.end)}</div></div></div>` : ''}${nxt ? `<div class="next-class" style="margin:0"><span class="n">${nxt.n}</span><div><b>القادمة: ${esc(nxt.cell.subject)} · ${D.time12(nxt.start)}</b><div class="small"><span class="cd soon">بعد ${D.dur(nxt.ms).replace('متبقٍ ', '')}</span></div></div></div>` : ''}</div>` : ''}
  ${noCells ? ATT : ''}
  <div class="tt-wrap">${ttHTML(sc, true)}</div>
  <p class="small muted">اضغطي على أي خانة لإضافة المادة والصف والفصل والملاحظات. تُميَّز الحصة الحالية بلون كامل والقادمة بإطار.${noCells ? ' ولتعبئته تلقائيًا ارفعي صورة جدولك من زر «رفع صورة/PDF».' : ''}</p>
  ${noCells ? '' : ATT}
`;
  $$('[data-sel]', el).forEach(b => b.onclick = () => { u.sel = b.dataset.sel; App.render(); });
  $$('[data-new]', el).forEach(b => b.onclick = () => editSchedule());
  $('[data-edit]', el).onclick = () => editSchedule(sc);
  $('[data-exp]', el).onclick = () => exportSchedule(sc);
  const fb = $('[data-fill]', el); if (fb) fb.onclick = () => App.Fill.open(sc);
  const mb = $('[data-main]', el); if (mb) mb.onclick = async () => { for (const o of S.schedules.filter(x => x.main)) await Store.put('schedules', Object.assign({}, o, {main: false})); await Store.put('schedules', Object.assign({}, sc, {main: true})); App.toast('أصبح هذا الجدول رئيسيًا'); };
  $('[data-up]', el).onclick = () => $('#schFile', el).click();
  $('#schFile', el).onchange = async e => {
    const files = Array.from(e.target.files); e.target.value = ''; const ids = [];
    for (const f of files) { try { App.toast('جارٍ رفع ' + f.name); const folder = await App.ensureFolder('الجداول الدراسية'); ids.push((await App.uploadFile(f, folder)).id); } catch(err) { App.toast(err.message, true); } }
    if (ids.length) { const cur2 = S.schedules.find(x => x.id === sc.id) || sc; await Store.put('schedules', Object.assign({}, cur2, {att: (cur2.att || []).concat(ids)})); App.toast('تم رفع الجدول وحفظه'); if (App.Fill) App.Fill.auto(sc.id, files.find(f => /^image\/|pdf/i.test(f.type || ''))); }
  };
  $$('[data-cell]', el).forEach(td => td.onclick = () => { const [d, p] = td.dataset.cell.split('-').map(Number); editCell(sc, d, p); });
  $$('[data-dl]', el).forEach(b => b.onclick = () => App.downloadFile(S.files.find(f => f.id === b.dataset.dl)));
  $$('[data-unatt]', el).forEach(b => b.onclick = async () => { await Store.put('schedules', Object.assign({}, sc, {att: (sc.att || []).filter(x => x !== b.dataset.unatt)})); App.toast('أزيل من الجدول (الملف باقٍ في مكتبة الملفات)'); });
  $$('[data-thumb]', el).forEach(box => { const f = S.files.find(x => x.id === box.dataset.thumb); if (f) App.fillThumb(box, f, box.style.height === 'auto' ? 'auto' : 'contain'); });
}});

/* ================= Plans ================= */
const PT = {
  remedial: {n:'الخطة العلاجية', goals:['معالجة الضعف في المهارات الأساسية','رفع مستوى الطلاب المتعثرين'], target:'الطلاب الذين لم يتقنوا المهارات', mech:'تشخيص مستوى الطلاب ثم تنفيذ حصص علاجية فردية وجماعية مع متابعة أسبوعية.', steps:['تطبيق اختبار تشخيصي','تحديد المهارات غير المتقنة لكل طالب','إعداد أنشطة وأوراق علاجية','تنفيذ الحصص العلاجية','تطبيق اختبار بعدي','التواصل مع أولياء الأمور'], kpis:[['نسبة الطلاب المتقنين بعد الخطة','80%'],['عدد الحصص العلاجية المنفذة','8']], exp:'تحسن مستوى الطلاب المستهدفين وإتقانهم للمهارات الأساسية.'},
  enrich: {n:'الخطة الإثرائية', goals:['تنمية مهارات الطلاب المتفوقين','تعزيز التفكير الإبداعي'], target:'الطلاب المتفوقون والموهوبون', mech:'أنشطة إثرائية ومسابقات ومشاريع قصيرة تتجاوز المقرر.', steps:['تحديد الطلاب المتفوقين','تصميم أنشطة إثرائية','تنفيذ مسابقة أو مشروع','عرض نتاجات الطلاب','تكريم المتميزين'], kpis:[['عدد المشاركين','10'],['عدد النتاجات المعروضة','5']], exp:'زيادة دافعية المتفوقين وظهور نتاجات مميزة.'},
  weekly: {n:'الخطة الأسبوعية', goals:['تنظيم دروس الأسبوع وتوزيعها'], target:'طلاب الصف', mech:'توزيع الدروس والأنشطة والواجبات على أيام الأسبوع.', steps:['الأحد: ','الاثنين: ','الثلاثاء: ','الأربعاء: ','الخميس: '], kpis:[['نسبة الدروس المنفذة','100%']], exp:'إنهاء دروس الأسبوع حسب الخطة.'},
  term: {n:'الخطة الفصلية', goals:['توزيع المنهج على أسابيع الفصل الدراسي'], target:'طلاب الصف', mech:'تقسيم الوحدات والدروس على الأسابيع مع مواعيد التقويم.', steps:['الوحدة الأولى','الوحدة الثانية','الوحدة الثالثة','المراجعة','الاختبارات النهائية'], kpis:[['نسبة إنجاز المنهج','100%'],['الالتزام بمواعيد التقويم','100%']], exp:'إكمال المنهج في وقته مع تقويم مستمر.'},
  improve: {n:'خطة التحسين', goals:['معالجة فجوة محددة في الأداء'], target:'', mech:'تحليل النتائج وتحديد أسباب الفجوة ثم تنفيذ إجراءات تحسين.', steps:['تحليل نتائج الاختبارات','تحديد الفجوات وأسبابها','وضع إجراءات التحسين','التنفيذ والمتابعة','قياس الأثر'], kpis:[['نسبة التحسن في النتائج','15%']], exp:'تحسن ملموس في المؤشر المستهدف.'},
  initiative: {n:'مبادرة تعليمية', goals:['هدف المبادرة الرئيسي'], target:'', mech:'وصف فكرة المبادرة وطريقة تنفيذها.', steps:['إعداد فكرة المبادرة','أخذ الموافقة','تجهيز المواد','الإطلاق والتنفيذ','التقييم وكتابة التقرير'], kpis:[['عدد المستفيدين',''],['نسبة الرضا','']], exp:''},
  committee: {n:'خطة لجنة', goals:['أهداف اللجنة للفصل الدراسي'], target:'منسوبو المدرسة', mech:'اجتماعات دورية وتوزيع المهام على الأعضاء.', steps:['الاجتماع الأول وتوزيع المهام','تنفيذ برامج اللجنة','الاجتماع الدوري للمتابعة','التقرير الختامي'], kpis:[['عدد البرامج المنفذة',''],['عدد الاجتماعات','']], exp:''},
  pd: {n:'خطة التطوير المهني', goals:['تطوير مهارة مهنية محددة'], target:'المعلمة نفسها', mech:'حضور دورات وقراءات وتطبيق ما تم تعلمه في الصف.', steps:['تحديد الاحتياج التدريبي','التسجيل في دورة أو برنامج','حضور التدريب','تطبيق المهارة في الصف','توثيق الأثر'], kpis:[['ساعات التدريب','20'],['عدد التطبيقات الصفية','3']], exp:'تحسن الممارسة المهنية في المجال المستهدف.'}
};
App.planProgress = p => { if (p.manual != null && p.manual !== '') return Math.max(0, Math.min(100, +p.manual)); const st = p.steps || []; return st.length ? Math.round(st.filter(s => s.done).length / st.length * 100) : 0; };
App.newPlan = () => App.modal({title:'خطة أو مبادرة جديدة', body:`<p class="muted" style="margin-top:0">ابدئي من قالب جاهز قابل للتعديل أو من صفحة فارغة.</p><div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(min(100%,200px),1fr))">${Object.entries(PT).map(([k, t]) => `<button class="tpl" data-tpl="${k}">${ic('target')}${t.n}</button>`).join('')}<button class="tpl" data-tpl="">${ic('plus')}خطة فارغة</button></div>`, foot:false, onMount(m, api) { $$('[data-tpl]', m).forEach(b => b.onclick = () => { api.close(); const t = PT[b.dataset.tpl]; App.editPlan(null, t ? {name: t.n, type: b.dataset.tpl, goals: t.goals.map(text => ({text})), target: t.target, mech: t.mech, steps: t.steps.map(text => ({text, done:false})), kpis: t.kpis.map(([text, target]) => ({text, target, actual:''})), expected: t.exp} : {}); }); }});
App.editPlan = (plan, preset={}) => {
  const p = Object.assign({name:'', type:'', goals:[], target:'', start:D.ymd(new Date()), end:'', mech:'', steps:[], kpis:[], expected:'', att:[], recs:'', manual:''}, preset, plan || {});
  App.modal({title: plan ? 'تعديل الخطة' : 'خطة جديدة', wide:true, body:`<div class="fgrid">
    <label class="f"><span>اسم الخطة *</span><input id="pn" value="${esc(p.name)}"></label>
    <label class="f"><span>نوع الخطة</span><select id="py"><option value="">بدون</option>${App.opts(Object.fromEntries(Object.entries(PT).map(([k, t]) => [k, t.n])), p.type)}</select></label>
    <label class="f"><span>تاريخ البداية</span><input type="date" id="ps" value="${esc(p.start)}"></label>
    <label class="f"><span>تاريخ النهاية</span><input type="date" id="pe" value="${esc(p.end)}"></label>
    <label class="f full"><span>الفئة المستهدفة</span><input id="pt" value="${esc(p.target)}"></label>
    <div class="f full" id="pg"><span style="font-weight:600">الأهداف</span>${App.dynList(p.goals, {ph:'هدف'})}</div>
    <label class="f full"><span>آلية التنفيذ</span><textarea id="pm" rows="3">${esc(p.mech)}</textarea></label>
    <div class="f full" id="pst"><span style="font-weight:600">خطوات التنفيذ</span>${App.dynList(p.steps, {ph:'خطوة', check:true, extra:'date'})}</div>
    <div class="f full" id="pk"><span style="font-weight:600">مؤشرات قياس الأداء</span>${App.dynList(p.kpis, {ph:'المؤشر', extra:'kpi'})}</div>
    <label class="f full"><span>النتائج المتوقعة</span><textarea id="px" rows="2">${esc(p.expected)}</textarea></label>
    <div class="f full"><span style="font-weight:600">الملفات والصور المرفقة</span>${App.attField(p.att)}</div>
    <label class="f full"><span>التوصيات والملاحظات</span><textarea id="pr" rows="3">${esc(p.recs)}</textarea></label>
    <label class="f"><span>نسبة الإنجاز يدويًا (اختياري)</span><input type="number" min="0" max="100" id="pp" value="${esc(p.manual)}" placeholder="تُحسب تلقائيًا من الخطوات"></label></div>`,
  onMount(m) { App.bindDyn(m); App.bindAtt(m, 'مرفقات الخطط'); },
  foot:[{label:'حفظ الخطة', cls:'primary', icon:'check', async onClick(api) {
    const m = api.el; const name = App.val(m, '#pn'); if (!name) { App.toast('اكتبي اسم الخطة', true); return false; }
    const s = App.val(m, '#ps'), e = App.val(m, '#pe'); if (s && e && e < s) { App.toast('تاريخ النهاية قبل البداية', true); return false; }
    await Store.put('plans', Object.assign({}, p, {name, type: $('#py', m).value, start: s, end: e, target: App.val(m, '#pt'), goals: App.readDyn($('#pg', m)), mech: App.val(m, '#pm'), steps: App.readDyn($('#pst', m)), kpis: App.readDyn($('#pk', m)), expected: App.val(m, '#px'), att: App.readAtt(m), recs: App.val(m, '#pr'), manual: App.val(m, '#pp')}));
    App.toast(plan ? 'تم تحديث الخطة' : 'تم إنشاء الخطة');
  }}, '|', ...(plan ? [{label:'حذف', cls:'ghost danger', icon:'trash', async onClick() { if (!(await App.confirm('حذف هذه الخطة نهائيًا؟'))) return false; await Store.del('plans', plan.id); App.toast('تم الحذف'); }}] : [])]});
};
const planHTML = (p, forExport) => {
  const pr = App.planProgress(p);
  const sec = (t, b) => b ? `<div class="section"><h4>${t}</h4>${b}</div>` : '';
  return `${sec('الفترة', `<div>${p.start ? esc(D.long(D.parse(p.start))) : '—'} ← ${p.end ? esc(D.long(D.parse(p.end))) : '—'}</div>`)}${sec('الفئة المستهدفة', p.target ? `<div>${esc(p.target)}</div>` : '')}${sec('الأهداف', (p.goals || []).length ? `<ol style="margin:0;padding-inline-start:20px">${p.goals.map(g => `<li>${esc(g.text)}</li>`).join('')}</ol>` : '')}${sec('آلية التنفيذ', p.mech ? `<div class="prose">${esc(p.mech)}</div>` : '')}
  ${sec(`خطوات التنفيذ (${pr}%)`, (p.steps || []).length ? `<div class="checklist">${p.steps.map((s, i) => `<label class="ci ${s.done ? 'done' : ''}">${forExport ? (s.done ? '☑' : '☐') : `<input type="checkbox" data-step="${i}" ${s.done ? 'checked' : ''}>`}<span style="flex:1">${esc(s.text)}</span>${s.due ? `<span class="small muted">${esc(D.short(D.parse(s.due)))}</span>` : ''}</label>`).join('')}</div>` : '')}
  ${sec('مؤشرات قياس الأداء', (p.kpis || []).length ? `<div class="tbl-wrap"><table class="data"><thead><tr><th>المؤشر</th><th>المستهدف</th><th>المتحقق</th></tr></thead><tbody>${p.kpis.map(k => `<tr><td>${esc(k.text)}</td><td>${esc(k.target || '—')}</td><td>${esc(k.actual || '—')}</td></tr>`).join('')}</tbody></table></div>` : '')}
  ${sec('النتائج المتوقعة', p.expected ? `<div class="prose">${esc(p.expected)}</div>` : '')}${forExport ? '' : sec('المرفقات', (p.att || []).length ? `<div class="chips">${App.attChips(p.att)}</div>` : '')}${sec('التوصيات والملاحظات', p.recs ? `<div class="prose">${esc(p.recs)}</div>` : '')}`;
};
App.showPlan = id => {
  const p = S.plans.find(x => x.id === id); if (!p) return;
  App.modal({title: p.name, wide:true, body:`<div class="row wrap" style="margin-bottom:14px">${p.type && PT[p.type] ? `<span class="badge acc">${PT[p.type].n}</span>` : ''}<span class="badge">الإنجاز ${App.planProgress(p)}%</span></div><div class="bar" style="margin-bottom:18px"><i style="width:${App.planProgress(p)}%"></i></div><div id="pbody">${planHTML(p)}</div>`,
  onMount(m) { m.addEventListener('change', async e => { const c = e.target.closest('[data-step]'); if (!c) return; const n = App.clone(S.plans.find(x => x.id === id)); n.steps[+c.dataset.step].done = c.checked; c.closest('.ci').classList.toggle('done', c.checked); await Store.put('plans', n); const pr = App.planProgress(n); $('.bar i', m).style.width = pr + '%'; }); },
  foot:[{label:'تعديل', cls:'primary', icon:'edit', onClick() { setTimeout(() => App.editPlan(S.plans.find(x => x.id === id)), 0); }}, {label:'تنزيل للطباعة', icon:'printer', close:false, onClick() { const q = S.plans.find(x => x.id === id); const pf = S.profile || {}; App.save(q.name + '.html', `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(q.name)}</title><style>body{font-family:"IBM Plex Sans Arabic",Tahoma,Arial,sans-serif;max-width:820px;margin:30px auto;padding:0 20px;line-height:1.7;color:#111}h1{margin:0}.section{margin:18px 0}.section h4{margin:0 0 6px;color:#2f5bea}table{border-collapse:collapse;width:100%}td,th{border:1px solid #bbb;padding:6px 8px;text-align:right}.ci{display:flex;gap:8px}.prose{white-space:pre-wrap}.small{font-size:13px;color:#666}button{padding:8px 16px;font:inherit}@media print{button{display:none}}</style></head><body><button onclick="print()">طباعة</button><h1>${esc(q.name)}</h1><p class="small">${esc([pf.name, pf.school].filter(Boolean).join(' · '))} · نسبة الإنجاز ${App.planProgress(q)}%</p>${planHTML(q, true)}</body></html>`); }},
    {label:'نسخ الخطة', icon:'copy', async onClick() { const n = App.clone(p); delete n.id; delete n.createdAt; n.name += ' (نسخة)'; (n.steps || []).forEach(s => s.done = false); await Store.put('plans', n); App.toast('تم إنشاء نسخة'); }}, '|', {label:'حذف', cls:'ghost danger', icon:'trash', async onClick() { if (!(await App.confirm('حذف هذه الخطة نهائيًا؟'))) return false; await Store.del('plans', id); App.toast('تم الحذف'); }}]});
};
App.ui.plans = {q:'', type:''};
App.view('plans', {title:'الخطط والمبادرات', render(el) {
  const u = App.ui.plans;
  el.innerHTML = `<div class="toolbar"><div class="search grow">${ic('search')}<input id="plq" placeholder="ابحثي في الخطط" value="${esc(u.q)}"></div><select id="plt" style="width:auto;flex:0 1 200px"><option value="">كل الأنواع</option>${App.opts(Object.fromEntries(Object.entries(PT).map(([k, t]) => [k, t.n])), u.type)}</select><button class="btn primary" id="plAdd">${ic('plus')}خطة جديدة</button></div><div id="plb"></div>
  <div class="section" style="margin-top:26px"><h4>قوالب جاهزة</h4><div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(min(100%,200px),1fr))">${Object.entries(PT).map(([k, t]) => `<button class="tpl" data-tpl="${k}">${ic('target')}${t.n}</button>`).join('')}</div></div>`;
  const draw = () => {
    const q = u.q.trim(); const list = S.plans.filter(p => (!u.type || p.type === u.type) && (!q || JSON.stringify([p.name, p.mech, p.goals, p.target, p.recs]).includes(q))).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    const b = $('#plb', el);
    if (!S.plans.length) { b.innerHTML = App.empty('target', 'لا توجد خطط بعد', 'أنشئي خطتك الأولى من قالب جاهز (علاجية، إثرائية، فصلية…) أو من الصفر.'); return; }
    b.innerHTML = list.length ? `<div class="grid cols-auto">${list.map(p => { const pr = App.planProgress(p); const st = p.steps || []; const late = p.end && D.parse(p.end + 'T23:59') < new Date() && pr < 100; return `<div class="pcard" data-plan="${p.id}"><div class="row between" style="align-items:flex-start"><div class="t">${esc(p.name)}</div>${p.type && PT[p.type] ? `<span class="badge acc">${PT[p.type].n.replace('الخطة ', '').replace('خطة ', '')}</span>` : ''}</div>${p.target ? `<div class="small muted">${esc(p.target)}</div>` : ''}<div class="row between small"><span>الإنجاز</span><b>${pr}%</b></div><div class="bar"><i style="width:${pr}%"></i></div><div class="row wrap small muted" style="gap:10px">${st.length ? `<span>${ic('list')} ${st.filter(s => s.done).length}/${st.length} خطوات</span>` : ''}${p.end ? `<span class="${late ? 'cd late' : ''}">${ic('cal')} حتى ${esc(D.short(D.parse(p.end)))}</span>` : ''}${(p.att || []).length ? `<span>${ic('file')} ${p.att.length}</span>` : ''}</div></div>`; }).join('')}</div>` : App.empty('search', 'لا نتائج', 'جرّبي كلمة بحث أخرى.');
    $$('[data-plan]', b).forEach(c => c.onclick = () => App.showPlan(c.dataset.plan));
  };
  draw();
  $('#plq', el).oninput = e => { u.q = e.target.value; draw(); };
  $('#plt', el).onchange = e => { u.type = e.target.value; draw(); };
  $('#plAdd', el).onclick = () => App.newPlan();
  $$('[data-tpl]', el).forEach(b => b.onclick = () => { const t = PT[b.dataset.tpl]; App.editPlan(null, {name: t.n, type: b.dataset.tpl, goals: t.goals.map(text => ({text})), target: t.target, mech: t.mech, steps: t.steps.map(text => ({text, done:false})), kpis: t.kpis.map(([text, target]) => ({text, target, actual:''})), expected: t.exp}); });
}});
})();
