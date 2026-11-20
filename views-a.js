/* لوحة التحكم + المهام */
'use strict';
(function(){
const {$, $$, esc, ic, D, K, S, Store} = App;
App.ui = {tasks:{mode:'list', q:'', cat:'', st:'', pri:'', sort:'due', month:new Date()}, cal:{mode:'month', d:new Date()}, dashEdit:false};

/* ================= Dashboard ================= */
const greet = () => { const h = new Date().getHours(); return h < 12 ? 'صباح الخير' : 'مساء الخير'; };
App.view('dashboard', {title:'الرئيسية', render(el) {
  const p = S.profile || {}; const now = new Date();
  const lay = Object.assign({order: K.DASH.map(x => x[0]), hidden: []}, p.layout || {});
  K.DASH.forEach(([id]) => { if (!lay.order.includes(id)) lay.order.push(id); });
  const first = (p.name || '').trim().split(/\s+/)[0] || '';
  const open = S.tasks.filter(t => t.status !== 'done');
  const todayT = open.filter(t => t.due && D.sameDay(D.parse(t.due), now));
  const late = open.filter(App.isLate).sort(byDue);
  const soon = open.filter(t => { if (!t.due) return false; const ms = D.parse(t.due) - now; return ms > 0 && ms < 3 * 86400000; }).sort(byDue);
  const wkEnd = D.addDays(new Date(now.getFullYear(), now.getMonth(), now.getDate()), 7);
  const weekEv = App.agenda(new Date(now.getFullYear(), now.getMonth(), now.getDate()), wkEnd);
  const total = S.tasks.length, done = S.tasks.filter(t => t.status === 'done').length;
  const pct = total ? Math.round(done / total * 100) : 0;
  const important = (S.notifs.items || []).filter(n => n.important && !n.read).slice(0, 4);

  const cards = {
    alerts: () => important.length ? `<div class="alerts-strip wide" style="grid-column:1/-1">${important.map(n => `<div class="a">${ic('alert')}<div><b>${esc(n.title)}</b><div class="small muted">${esc(n.body || '')}</div></div><button class="btn sm" data-seen="${n.id}">تمت المشاهدة</button></div>`).join('')}</div>` : '',
    stats: () => `<div class="stat-row" style="grid-column:1/-1;margin:0">
      <a class="stat" href="#tasks"><b>${todayT.length}</b><span>مهام اليوم</span></a>
      <a class="stat ${late.length ? 'alert' : ''}" href="#tasks" data-filter-late><b>${late.length}</b><span>أعمال متأخرة</span></a>
      <a class="stat" href="#tasks"><b>${S.tasks.filter(t => t.status === 'doing').length}</b><span>قيد التنفيذ</span></a>
      <a class="stat" href="#calendar"><b>${weekEv.filter(x => x.kind === 'event').length}</b><span>مواعيد هذا الأسبوع</span></a></div>`,
    today: () => card('today', 'مهام اليوم', 'check', todayT.length ? `<div class="mini">${todayT.sort(byDue).map(miniTask).join('')}</div>` : small('لا مهام مستحقة اليوم.', `<button class="btn sm" data-add="task">${ic('plus')}مهمة لليوم</button>`), '#tasks'),
    late: () => card('late', 'الأعمال المتأخرة', 'alert', late.length ? `<div class="mini">${late.slice(0, 6).map(miniTask).join('')}</div>${late.length > 6 ? `<p class="small muted">و${late.length - 6} أخرى</p>` : ''}` : small('لا توجد أعمال متأخرة. أحسنتِ!'), '#tasks'),
    soon: () => card('soon', 'اقترب موعد تسليمها', 'clock', soon.length ? `<div class="mini">${soon.slice(0, 6).map(miniTask).join('')}</div>` : small('لا أعمال مستحقة خلال الأيام الثلاثة القادمة.'), '#tasks'),
    classes: () => card('classes', 'الحصص القادمة', 'grid', classesCard(), '#schedules'),
    progress: () => card('progress', 'نسبة إنجاز المهام', 'target', total ? `<div class="ring">${ring(pct)}<div><div class="big">${pct}%</div><div class="muted small">${done} مكتملة من ${total}</div><div class="small" style="margin-top:6px">${Object.entries(K.ST).map(([k, l]) => `<div class="row between"><span>${l}</span><b>${S.tasks.filter(t => (t.status || 'todo') === k).length}</b></div>`).join('')}</div></div></div>` : small('أضيفي مهامك لتظهر نسبة الإنجاز هنا.')),
    week: () => card('week', 'مواعيد الأسبوع', 'cal', weekEv.length ? `<div class="mini">${weekEv.slice(0, 8).map(x => `<div class="m" data-agenda="${x.kind}:${x.id}"><span class="badge ${x.kind === 'task' ? 'mid' : 'acc'}">${esc(D.wday(x.date))}</span><span class="t">${esc(x.title)}</span><span class="small muted">${x.time ? D.time12(x.time) : ''}</span></div>`).join('')}</div>` : small('لا مواعيد خلال الأيام السبعة القادمة.', `<button class="btn sm" data-add="event">${ic('plus')}موعد جديد</button>`), '#calendar'),
    quick: () => card('quick', 'اختصارات سريعة', 'plus', `<div class="quick">${[['task','مهمة جديدة','check'],['plan','خطة جديدة','target'],['link','رابط جديد','link'],['file','رفع ملف','upload'],['event','موعد جديد','cal'],['note','ملاحظة جديدة','note']].map(([k, l, i]) => `<button data-add="${k}">${ic(i)}${l}</button>`).join('')}</div>`),
    qnote: () => card('qnote', 'ملاحظات سريعة', 'note', `<textarea id="qnote" data-nore rows="5" placeholder="اكتبي هنا… تُحفظ تلقائيًا">${esc(S.quick.text || '')}</textarea><div class="small muted" id="qnoteSt" style="margin-top:6px">${S.quick.updatedAt ? 'آخر حفظ ' + D.fmtDT(D.ymd(new Date(S.quick.updatedAt)) + 'T' + D.hm(new Date(S.quick.updatedAt))) : ''}</div>`),
    cats: () => { const rows = K.TASK_CATS.map(c => [c, S.tasks.filter(t => t.cat === c).length]).filter(r => r[1]); const mx = Math.max(1, ...rows.map(r => r[1]));
      return card('cats', 'توزيع المهام حسب التصنيف', 'sliders', rows.length ? `<div class="hbars">${rows.sort((a, b) => b[1] - a[1]).map(([c, n]) => `<div class="r"><span title="${esc(c)}" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c)}</span><div class="bar"><i style="width:${n / mx * 100}%"></i></div><span>${n}</span></div>`).join('')}</div>` : small('سيظهر الرسم عند إضافة مهام مصنفة.')); }
  };
  const order = lay.order.filter(id => cards[id] && !lay.hidden.includes(id));
  el.innerHTML = `
  <section class="hello">
    <div class="welcome">
      <svg class="deco" viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="100" r="90" stroke="currentColor" stroke-width="18" fill="none"/><circle cx="100" cy="100" r="45" fill="currentColor" stroke="none"/></svg>
      <h2>${greet()}${first ? '، ' + esc(first) : ''}</h2>
      <p>${todayT.length ? `لديكِ ${todayT.length} ${todayT.length === 1 ? 'مهمة' : 'مهام'} اليوم` : 'يومك منظم، لا مهام مستحقة اليوم'}${late.length ? ` و${late.length} متأخرة` : ''}.</p>
      <div class="meta">${[p.school, p.subject, p.stage].filter(Boolean).map(x => `<span>${esc(x)}</span>`).join('')}</div>
    </div>
    <div class="card clock"><div class="t" id="clockT">${D.time12(D.hm(now))}</div><div class="d">${esc(D.long(now))}</div><div class="muted small">${esc(D.hijri(now))}</div></div>
  </section>
  <div class="toolbar"><span class="grow"></span><button class="btn sm ghost" id="dashEdit">${ic('sliders')}تخصيص اللوحة</button></div>
  <div class="dash">${order.map(id => cards[id]()).join('')}</div>`;

  $('#dashEdit', el).onclick = () => customize(lay);
  $$('[data-add]', el).forEach(b => b.onclick = () => App.quickAdd(b.dataset.add));
  $$('[data-seen]', el).forEach(b => b.onclick = () => App.markRead([b.dataset.seen]));
  $$('[data-agenda]', el).forEach(b => b.onclick = () => { const [k, id] = b.dataset.agenda.split(':'); k === 'task' ? App.showTask(id) : App.editEvent(S.events.find(e => e.id === id)); });
  const late1 = $('[data-filter-late]', el); if (late1) late1.onclick = () => { App.ui.tasks.st = 'late'; };
  bindMini(el);
  const q = $('#qnote', el);
  if (q) { const save = App.debounce(async () => { S.quick = {text: q.value}; try { await App.saveMeta('quick', S.quick); const st = $('#qnoteSt'); if (st) st.textContent = 'تم الحفظ'; } catch(e) {} }, 700); q.addEventListener('input', () => { const st = $('#qnoteSt'); if (st) st.textContent = 'جارٍ الحفظ…'; save(); }); }
}});
const byDue = (a, b) => (a.due || '9999').localeCompare(b.due || '9999');
const small = (t, btn='') => `<div class="muted small" style="padding:6px 0">${esc(t)}</div>${btn}`;
const card = (id, title, icon, body, more) => `<div class="card" data-card="${id}"><h3>${ic(icon)}${esc(title)}${more ? `<a class="more" href="${more}">عرض الكل</a>` : ''}</h3>${body}</div>`;
const ring = pct => { const r = 44, c = 2 * Math.PI * r; return `<svg viewBox="0 0 110 110" aria-label="${pct}%"><circle cx="55" cy="55" r="${r}" stroke="var(--surface2)"/><circle cx="55" cy="55" r="${r}" stroke="var(--accent)" stroke-dasharray="${c}" stroke-dashoffset="${c - c * pct / 100}" transform="rotate(-90 55 55)" style="transition:stroke-dashoffset .6s"/></svg>`; };
const miniTask = t => `<div class="m" data-task="${t.id}"><input type="checkbox" data-done="${t.id}" aria-label="إنجاز"><span class="t">${esc(t.title)}</span>${App.cdHTML(t.due)}</div>`;
const bindMini = el => {
  $$('[data-done]', el).forEach(c => { c.onclick = e => { e.stopPropagation(); App.setStatus(c.dataset.done, 'done'); }; });
  $$('.m[data-task]', el).forEach(m => m.onclick = () => App.showTask(m.dataset.task));
};
function classesCard() {
  const info = App.schedInfo ? App.schedInfo() : null;
  if (!info) return small('أنشئي جدول الحصص وحدديه كجدول رئيسي ليظهر هنا.', `<a class="btn sm" href="#schedules">${ic('grid')}الجداول</a>`);
  if (!info.today.length) return small(info.nextDay ? `لا حصص اليوم. أقرب يوم دراسي: ${info.nextDay}.` : 'لا حصص اليوم.');
  const cur = info.today.find(x => x.state === 'now'), nxt = info.today.find(x => x.state === 'next');
  let h = '';
  if (cur) h += `<div class="next-class"><span class="n">${cur.n}</span><div style="flex:1"><b>الحصة الحالية: ${esc(cur.cell.subject || 'حصة')}</b><div class="small muted">${esc([cur.cell.grade, cur.cell.section].filter(Boolean).join(' / '))} · تنتهي ${D.time12(cur.end)}</div></div></div>`;
  if (nxt) h += `<div class="next-class" style="background:var(--surface2)"><span class="n">${nxt.n}</span><div style="flex:1"><b>القادمة: ${esc(nxt.cell.subject || 'حصة')}</b><div class="small muted">${esc([nxt.cell.grade, nxt.cell.section].filter(Boolean).join(' / '))} · ${D.time12(nxt.start)} · <span class="cd soon" data-cdc="${nxt.start}">بعد ${D.dur(nxt.ms).replace('متبقٍ ', '')}</span></div></div></div>`;
  const rest = info.today.filter(x => x.state === 'later');
  if (rest.length) h += `<div class="mini">${rest.map(x => `<div class="m"><span class="badge">${x.n}</span><span class="t">${esc(x.cell.subject)}</span><span class="small muted">${D.time12(x.start)}</span></div>`).join('')}</div>`;
  if (!cur && !nxt && !rest.length) h = small('انتهت حصص اليوم.');
  return h;
}
function customize(lay) {
  const draw = () => `<p class="muted small" style="margin-top:0">رتّبي البطاقات بالأسهم، واضغطي العين لإظهارها أو إخفائها.</p><ul>${lay.order.map((id, i) => { const n = (K.DASH.find(x => x[0] === id) || [id, id])[1]; const off = lay.hidden.includes(id); return `<li class="${off ? 'off' : ''}"><span>${esc(n)}</span><button class="icon-btn sm" data-up="${i}" aria-label="أعلى" ${i ? '' : 'disabled'}>${ic('up')}</button><button class="icon-btn sm" data-dn="${i}" aria-label="أسفل" ${i < lay.order.length - 1 ? '' : 'disabled'}>${ic('down')}</button><button class="icon-btn sm" data-vis="${id}" aria-label="${off ? 'إظهار' : 'إخفاء'}">${ic(off ? 'eyeoff' : 'eye')}</button></li>`; }).join('')}</ul>`;
  App.modal({title:'تخصيص لوحة التحكم', body:`<div class="customize" id="cz">${draw()}</div>`, onMount(m) {
    const box = $('#cz', m);
    box.onclick = e => { const b = e.target.closest('button'); if (!b) return; const o = lay.order;
      if (b.dataset.up) { const i = +b.dataset.up; [o[i - 1], o[i]] = [o[i], o[i - 1]]; }
      if (b.dataset.dn) { const i = +b.dataset.dn; [o[i + 1], o[i]] = [o[i], o[i + 1]]; }
      if (b.dataset.vis) { const id = b.dataset.vis; lay.hidden = lay.hidden.includes(id) ? lay.hidden.filter(x => x !== id) : lay.hidden.concat(id); }
      box.innerHTML = draw(); };
  }, foot:[{label:'حفظ الترتيب', cls:'primary', async onClick(){ await App.saveProfile({layout: lay}); App.toast('تم حفظ تخصيص اللوحة'); }}, {label:'استعادة الافتراضي', cls:'ghost', async onClick(){ await App.saveProfile({layout: null}); }}]});
}

/* ================= Quick add ================= */
App.quickAdd = kind => {
  if (!kind) {
    App.modal({title:'إضافة سريعة', body:`<div class="quick">${[['task','مهمة','check'],['event','موعد أو حدث','cal'],['plan','خطة أو مبادرة','target'],['link','رابط أو مورد','link'],['file','رفع ملف','upload'],['note','ملاحظة','note']].map(([k, l, i]) => `<button data-k="${k}">${ic(i)}${l}</button>`).join('')}</div>`, foot:false, onMount(m, api) { $$('[data-k]', m).forEach(b => b.onclick = () => { api.close(); App.quickAdd(b.dataset.k); }); }});
    return;
  }
  ({task: () => App.editTask(), event: () => App.editEvent(), plan: () => App.newPlan(), link: () => App.editLink(), file: () => App.uploadDialog(), note: () => App.editNote()})[kind]();
};

/* ================= Tasks ================= */
App.setStatus = async (id, st) => {
  const t = S.tasks.find(x => x.id === id); if (!t) return;
  const n = Object.assign({}, t, {status: st}); if (st === 'done') n.doneAt = Date.now();
  Object.assign(t, n); App.flush();
  try { await Store.put('tasks', n); if (st === 'done') App.toast('أحسنتِ! اكتملت المهمة'); } catch(e) {}
};
const remindLabel = m => { const r = K.REMIND.find(x => x[0] === m); return r ? r[1] : (m >= 0 ? `قبل ${m} دقيقة` : 'بدون تنبيه'); };
App.remindLabel = remindLabel;
App.remindField = (val, id='rm') => {
  const known = K.REMIND.some(x => x[0] === val);
  const v = val == null ? 60 : val;
  return `<label class="f"><span>التنبيه</span><select id="${id}">${K.REMIND.map(([m, l]) => `<option value="${m}" ${(known ? m === v : m === 'c') ? 'selected' : ''}>${l}</option>`).join('')}</select></label><label class="f" id="${id}cw" ${known ? 'hidden' : ''}><span>قبل كم دقيقة؟</span><input type="number" min="0" id="${id}c" value="${known ? '' : v}" inputmode="numeric"></label>`;
};
App.bindRemind = (m, id='rm') => { const s = $('#' + id, m); s.onchange = () => { $('#' + id + 'cw', m).hidden = s.value !== 'c'; }; };
App.readRemind = (m, id='rm') => { const v = $('#' + id, m).value; if (v === 'c') { const n = parseInt($('#' + id + 'c', m).value, 10); return isNaN(n) ? 60 : Math.max(0, n); } return Number(v); };

App.editTask = (task, preset={}) => {
  const t = Object.assign({title:'', desc:'', due:'', pri:'mid', cat:K.TASK_CATS[0], status:'todo', remind:60, links:[], att:[], subs:[], notes:''}, preset, task || {});
  const [dd, dt] = (t.due || '').split('T');
  App.modal({title: task ? 'تعديل المهمة' : 'مهمة جديدة', wide:true, body:`
  <div class="fgrid">
    <label class="f full"><span>عنوان المهمة *</span><input id="tt" value="${esc(t.title)}" placeholder="مثال: تصحيح اختبار الوحدة الثانية" maxlength="160"></label>
    <label class="f full"><span>الوصف</span><textarea id="td" rows="3" placeholder="تفاصيل المهمة">${esc(t.desc)}</textarea></label>
    <label class="f"><span>تاريخ الانتهاء</span><input type="date" id="tdd" value="${esc(dd || '')}"></label>
    <label class="f"><span>وقت الانتهاء</span><input type="time" id="tdt" value="${esc(dt || (dd ? '' : ''))}"></label>
    <label class="f"><span>الأولوية</span><select id="tp">${App.opts(K.PRI, t.pri)}</select></label>
    <label class="f"><span>التصنيف</span><select id="tc">${App.opts(K.TASK_CATS, t.cat)}</select></label>
    <label class="f"><span>الحالة</span><select id="ts">${App.opts(K.ST, t.status)}</select></label>
    <div>${App.remindField(t.remind)}</div>
    <div class="f full"><span style="font-weight:600">المهام الفرعية</span>${App.dynList(t.subs, {ph:'مهمة فرعية', check:true})}</div>
    <label class="f full"><span>روابط (رابط في كل سطر)</span><textarea id="tl" rows="2" dir="ltr" placeholder="https://">${esc((t.links || []).join('\n'))}</textarea></label>
    <div class="f full"><span style="font-weight:600">المرفقات</span>${App.attField(t.att)}</div>
    <label class="f full"><span>ملاحظات</span><textarea id="tn" rows="3">${esc(t.notes)}</textarea></label>
  </div>`, onMount(m) { App.bindDyn(m); App.bindAtt(m, 'مرفقات المهام'); App.bindRemind(m); },
  foot:[{label:'حفظ المهمة', cls:'primary', icon:'check', async onClick(api) {
    const m = api.el; const title = App.val(m, '#tt'); if (!title) { App.toast('اكتبي عنوان المهمة', true); $('#tt', m).focus(); return false; }
    const d = App.val(m, '#tdd'), tm = App.val(m, '#tdt');
    const n = Object.assign({}, t, {title, desc: App.val(m, '#td'), due: d ? `${d}T${tm || '23:59'}` : '', pri: $('#tp', m).value, cat: $('#tc', m).value, status: $('#ts', m).value, remind: App.readRemind(m), subs: [], links: App.val(m, '#tl').split(/\n+/).map(s => s.trim()).filter(Boolean), att: App.readAtt(m), notes: App.val(m, '#tn')});
    n.subs = App.readDyn($$('.f.full', m).find(x => x.querySelector('[data-dyn]')));
    if (n.status === 'done' && t.status !== 'done') n.doneAt = Date.now();
    await Store.put('tasks', n); App.toast(task ? 'تم تحديث المهمة' : 'تمت إضافة المهمة');
  }}, '|', ...(task ? [{label:'حذف', cls:'ghost danger', icon:'trash', async onClick() { if (!(await App.confirm('حذف هذه المهمة نهائيًا؟'))) return false; await Store.del('tasks', task.id); App.toast('تم الحذف'); }}] : [])]});
};

App.showTask = id => {
  const t = S.tasks.find(x => x.id === id); if (!t) return;
  const subs = t.subs || []; const sd = subs.filter(s => s.done).length;
  const linkedEv = S.events.filter(e => e.taskId === t.id);
  App.modal({title: t.title, wide:true, body:`
    <div class="row wrap" style="margin-bottom:14px"><span class="badge ${t.pri}">أولوية ${K.PRI[t.pri] || ''}</span><span class="badge">${esc(t.cat || '')}</span><span class="badge acc">${K.ST[t.status || 'todo']}</span>${t.due ? `<span class="badge">${ic('clock')}${esc(D.fmtDT(t.due))}</span>` : ''}${App.cdHTML(t.due, t.status === 'done')}</div>
    <div class="row wrap" style="margin-bottom:16px"><span class="small muted">تغيير الحالة:</span><div class="seg" id="stSeg">${Object.entries(K.ST).map(([k, l]) => `<button data-st="${k}" class="${(t.status || 'todo') === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
    ${t.desc ? `<div class="section"><h4>الوصف</h4><div class="prose">${esc(t.desc)}</div></div>` : ''}
    ${subs.length ? `<div class="section"><h4>المهام الفرعية (${sd}/${subs.length})</h4><div class="bar" style="margin-bottom:10px"><i style="width:${sd / subs.length * 100}%"></i></div><div class="checklist">${subs.map((s, i) => `<label class="ci ${s.done ? 'done' : ''}"><input type="checkbox" data-sub="${i}" ${s.done ? 'checked' : ''}><span>${esc(s.text)}</span></label>`).join('')}</div></div>` : ''}
    ${(t.links || []).length ? `<div class="section"><h4>الروابط</h4><div class="chips">${App.linkChips(t.links)}</div></div>` : ''}
    ${(t.att || []).length ? `<div class="section"><h4>المرفقات</h4><div class="chips">${App.attChips(t.att)}</div></div>` : ''}
    ${t.notes ? `<div class="section"><h4>ملاحظات</h4><div class="prose">${esc(t.notes)}</div></div>` : ''}
    ${linkedEv.length ? `<div class="section"><h4>مواعيد مرتبطة</h4><div class="chips">${linkedEv.map(e => `<span class="chip">${ic('cal')}${esc(e.title)} · ${esc(D.short(D.parse(e.date)))}</span>`).join('')}</div></div>` : ''}
    <p class="small muted">التنبيه: ${esc(remindLabel(t.remind))}</p>`,
  onMount(m, api) {
    $$('[data-st]', m).forEach(b => b.onclick = async () => { await App.setStatus(t.id, b.dataset.st); $$('[data-st]', m).forEach(x => x.classList.toggle('on', x === b)); });
    $$('[data-sub]', m).forEach(c => c.onchange = async () => { const n = App.clone(S.tasks.find(x => x.id === t.id)); n.subs[+c.dataset.sub].done = c.checked; c.closest('.ci').classList.toggle('done', c.checked); const d2 = n.subs.filter(s => s.done).length; const bar = $('.bar i', m); if (bar) bar.style.width = d2 / n.subs.length * 100 + '%'; await Store.put('tasks', n); });
  },
  foot:[{label:'تعديل', cls:'primary', icon:'edit', onClick() { setTimeout(() => App.editTask(S.tasks.find(x => x.id === t.id)), 0); }}, {label:'موعد في التقويم', cls:'', icon:'cal', onClick() { setTimeout(() => App.editEvent(null, {title: t.title, date: (t.due || '').split('T')[0] || D.ymd(new Date()), taskId: t.id, type:'submit'}), 0); }}, '|', {label:'حذف', cls:'ghost danger', icon:'trash', async onClick() { if (!(await App.confirm('حذف هذه المهمة نهائيًا؟'))) return false; await Store.del('tasks', t.id); App.toast('تم الحذف'); }}]});
};

const taskRow = t => {
  const subs = t.subs || []; const sd = subs.filter(s => s.done).length; const done = t.status === 'done';
  return `<div class="item ${done ? 'done' : ''}" data-id="${t.id}"><input type="checkbox" data-done="${t.id}" ${done ? 'checked' : ''} aria-label="إنجاز" style="margin-top:3px"><div class="body" data-open="${t.id}"><div class="t">${esc(t.title)}</div><div class="meta"><span class="badge ${t.pri}">${K.PRI[t.pri] || ''}</span><span class="badge">${esc(t.cat || '')}</span>${t.status === 'doing' ? '<span class="badge acc">قيد التنفيذ</span>' : ''}${t.due ? `<span>${ic('clock')} ${esc(D.fmtDT(t.due))}</span>` : ''}${App.cdHTML(t.due, done)}${subs.length ? `<span>${ic('list')} ${sd}/${subs.length}</span>` : ''}${(t.att || []).length ? `<span>${ic('file')} ${t.att.length}</span>` : ''}${t.remind >= 0 && t.due && !done ? `<span title="${esc(remindLabel(t.remind))}">${ic('bell')}</span>` : ''}</div></div><div class="acts"><button class="icon-btn sm" data-edit="${t.id}" aria-label="تعديل">${ic('edit')}</button><button class="icon-btn sm" data-del="${t.id}" aria-label="حذف">${ic('trash')}</button></div></div>`;
};
const filtered = () => {
  const u = App.ui.tasks; const q = u.q.trim();
  let list = S.tasks.filter(t => (!u.cat || t.cat === u.cat) && (!u.pri || t.pri === u.pri) && (!u.st || (u.st === 'late' ? App.isLate(t) : (t.status || 'todo') === u.st)) && (!q || (t.title + ' ' + (t.desc || '') + ' ' + (t.notes || '')).includes(q)));
  const pr = {high:0, mid:1, low:2};
  list.sort(u.sort === 'pri' ? (a, b) => (pr[a.pri] ?? 1) - (pr[b.pri] ?? 1) || byDue(a, b) : u.sort === 'new' ? (a, b) => (b.createdAt || 0) - (a.createdAt || 0) : (a, b) => ((a.status === 'done') - (b.status === 'done')) || byDue(a, b));
  return list;
};
App.view('tasks', {title:'المهام', render(el) {
  const u = App.ui.tasks;
  el.innerHTML = `
  <div class="toolbar">
    <div class="seg" role="tablist">${[['list','قائمة','list'],['kanban','لوحة Kanban','kanban'],['cal','تقويم','cal']].map(([k, l, i]) => `<button data-mode="${k}" class="${u.mode === k ? 'on' : ''}">${ic(i)}${l}</button>`).join('')}</div>
    <div class="search grow">${ic('search')}<input id="tq" placeholder="ابحثي في المهام" value="${esc(u.q)}"></div>
    <button class="btn primary" id="addT">${ic('plus')}مهمة جديدة</button>
  </div>
  <div class="toolbar">
    <select id="fc" style="width:auto;flex:1 1 160px"><option value="">كل التصنيفات</option>${App.opts(K.TASK_CATS, u.cat)}</select>
    <select id="fs" style="width:auto;flex:1 1 130px"><option value="">كل الحالات</option>${App.opts(Object.assign({}, K.ST, {late:'متأخرة'}), u.st)}</select>
    <select id="fp" style="width:auto;flex:1 1 130px"><option value="">كل الأولويات</option>${App.opts(K.PRI, u.pri)}</select>
    ${u.mode === 'list' ? `<select id="fo" style="width:auto;flex:1 1 130px">${App.opts({due:'ترتيب: الموعد', pri:'ترتيب: الأولوية', new:'ترتيب: الأحدث'}, u.sort)}</select>` : ''}
  </div>
  <div id="tbody"></div>`;
  $$('[data-mode]', el).forEach(b => b.onclick = () => { u.mode = b.dataset.mode; App.render(); });
  $('#addT', el).onclick = () => App.editTask();
  $('#tq', el).oninput = e => { u.q = e.target.value; drawBody(); };
  $('#fc', el).onchange = e => { u.cat = e.target.value; drawBody(); };
  $('#fs', el).onchange = e => { u.st = e.target.value; drawBody(); };
  $('#fp', el).onchange = e => { u.pri = e.target.value; drawBody(); };
  const fo = $('#fo', el); if (fo) fo.onchange = e => { u.sort = e.target.value; drawBody(); };
  drawBody();
  function drawBody() {
    const b = $('#tbody', el); const list = filtered();
    if (!S.tasks.length) { b.innerHTML = App.empty('check', 'لا توجد مهام بعد', 'ابدئي بإضافة أول مهمة: تحضير درس، تصحيح، اجتماع…', `<button class="btn primary" data-new>${ic('plus')}إضافة مهمة</button>`); $('[data-new]', b).onclick = () => App.editTask(); return; }
    if (u.mode === 'list') {
      b.innerHTML = list.length ? `<div class="items">${list.map(taskRow).join('')}</div>` : App.empty('search', 'لا نتائج', 'جرّبي تغيير البحث أو عوامل التصفية.');
    } else if (u.mode === 'kanban') {
      b.innerHTML = `<div class="kanban">${Object.entries(K.ST).map(([k, l]) => { const col = list.filter(t => (t.status || 'todo') === k); return `<div class="col" data-col="${k}"><h4>${l}<span class="badge">${col.length}</span></h4>${col.map(t => `<div class="kcard" draggable="true" data-kid="${t.id}"><div class="t" data-open="${t.id}" style="cursor:pointer">${esc(t.title)}</div><div class="row wrap" style="gap:6px"><span class="badge ${t.pri}">${K.PRI[t.pri] || ''}</span>${t.due ? `<span class="small muted">${esc(D.short(D.parse(t.due)))}</span>` : ''}${App.cdHTML(t.due, t.status === 'done')}</div><select data-move="${t.id}" aria-label="نقل إلى">${App.opts(K.ST, t.status || 'todo')}</select></div>`).join('') || '<div class="small muted" style="padding:10px;text-align:center">اسحبي مهمة إلى هنا</div>'}</div>`; }).join('')}</div>`;
      $$('[data-kid]', b).forEach(c => c.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', c.dataset.kid); e.dataTransfer.effectAllowed = 'move'; }));
      $$('[data-col]', b).forEach(col => { col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('over'); }); col.addEventListener('dragleave', () => col.classList.remove('over')); col.addEventListener('drop', e => { e.preventDefault(); col.classList.remove('over'); const id = e.dataTransfer.getData('text/plain'); if (id) App.setStatus(id, col.dataset.col); }); });
      $$('[data-move]', b).forEach(s => s.onchange = () => App.setStatus(s.dataset.move, s.value));
    } else {
      b.innerHTML = App.monthGrid(u.month, d => list.filter(t => t.due && D.sameDay(D.parse(t.due), d)).map(t => `<div class="ev task ${t.status === 'done' ? 'done' : ''}" data-open="${t.id}" title="${esc(t.title)}">${esc(t.title)}</div>`), 'tm');
      App.bindMonth(b, 'tm', u, 'month', drawBody, d => App.editTask(null, {due: D.ymd(d) + 'T23:59'}));
    }
    $$('[data-done]', b).forEach(c => c.onchange = () => App.setStatus(c.dataset.done, c.checked ? 'done' : 'todo'));
    $$('[data-open]', b).forEach(x => x.onclick = e => { e.stopPropagation(); App.showTask(x.dataset.open); });
    $$('[data-edit]', b).forEach(x => x.onclick = () => App.editTask(S.tasks.find(t => t.id === x.dataset.edit)));
    $$('[data-del]', b).forEach(x => x.onclick = async () => { if (await App.confirm('حذف هذه المهمة نهائيًا؟')) { await Store.del('tasks', x.dataset.del); App.toast('تم الحذف'); } });
  }
}});

/* ---------- shared month grid ---------- */
App.monthGrid = (month, dayItems, key) => {
  const y = month.getFullYear(), mo = month.getMonth(); const first = new Date(y, mo, 1); const start = D.addDays(first, -first.getDay()); const today = new Date();
  let cells = '';
  for (let i = 0; i < 42; i++) {
    const d = D.addDays(start, i); if (i >= 35 && d.getMonth() !== mo) break;
    const items = dayItems(d); const show = items.slice(0, 3);
    cells += `<div class="day ${d.getMonth() !== mo ? 'other' : ''} ${D.sameDay(d, today) ? 'today' : ''}" data-day="${D.ymd(d)}"><span class="num">${d.getDate()}</span>${show.join('')}${items.length > 3 ? `<div class="ev more">+${items.length - 3}</div>` : ''}</div>`;
  }
  return `<div class="cal-head"><h2>${esc(D.month(month))}</h2><button class="icon-btn" data-${key}-prev aria-label="الشهر السابق">${ic('right')}</button><button class="btn sm" data-${key}-today>اليوم</button><button class="icon-btn" data-${key}-next aria-label="الشهر التالي">${ic('left')}</button></div><div class="month">${D.DAYS.map(d => `<div class="dow">${d.replace('ال', '').slice(0, 3)}</div>`).join('')}${cells}</div>`;
};
App.bindMonth = (root, key, state, prop, redraw, onDay) => {
  const m = state[prop];
  $(`[data-${key}-prev]`, root).onclick = () => { state[prop] = new Date(m.getFullYear(), m.getMonth() - 1, 1); redraw(); };
  $(`[data-${key}-next]`, root).onclick = () => { state[prop] = new Date(m.getFullYear(), m.getMonth() + 1, 1); redraw(); };
  $(`[data-${key}-today]`, root).onclick = () => { state[prop] = new Date(); redraw(); };
  $$('[data-day]', root).forEach(c => c.onclick = e => { if (e.target.closest('.ev:not(.more)')) return; onDay(D.parse(c.dataset.day)); });
};

/* agenda: tasks + events between two dates */
App.agenda = (from, to) => {
  const out = [];
  S.events.forEach(e => { const d = D.parse(e.date + 'T' + (e.start || '00:00')); if (d && d >= from && d < to) out.push({kind:'event', id:e.id, title:e.title, date:d, time:e.start, type:e.type}); });
  S.tasks.forEach(t => { if (t.status === 'done' || !t.due) return; const d = D.parse(t.due); if (d >= from && d < to) out.push({kind:'task', id:t.id, title:t.title, date:d, time:D.hm(d)}); });
  return out.sort((a, b) => a.date - b.date);
};
})();
