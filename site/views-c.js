/* الروابط + الملفات + المفكرة + الإشعارات + الحساب + المطور + حول */
'use strict';
(function(){
const {$, $$, esc, ic, D, K, S, Store} = App;

/* ================= Links ================= */
App.ui.links = {q:'', cat:'', folder:'', fav:false};
const lcat = id => K.LINK_CATS.find(c => c[0] === id) || K.LINK_CATS[K.LINK_CATS.length - 1];
const hostOf = u => { try { return new URL(App.safeUrl(u)).hostname.replace(/^www\./, ''); } catch(e) { return u; } };
App.editLink = (link, preset={}) => {
  const l = Object.assign({title:'', url:'', desc:'', cat:'game', folder: App.ui.links.folder || '', fav:false, img:''}, preset, link || {});
  App.modal({title: link ? 'تعديل الرابط' : 'إضافة رابط أو مورد', body:`<div class="fgrid">
    <label class="f full"><span>الرابط *</span><input id="lu" dir="ltr" inputmode="url" value="${esc(l.url)}" placeholder="https://wordwall.net/..."></label>
    <label class="f full"><span>العنوان *</span><input id="lt" value="${esc(l.title)}" placeholder="مثال: لعبة مطابقة الكلمات"></label>
    <label class="f"><span>التصنيف</span><select id="lc">${App.opts(K.LINK_CATS.map(c => [c[0], c[1]]), l.cat)}</select></label>
    <label class="f"><span>المجلد (مادة / فصل)</span><select id="lf"><option value="">بدون مجلد</option>${App.opts(S.lfolders.map(f => [f.id, f.name]), l.folder)}</select></label>
    <label class="f full"><span>الوصف</span><textarea id="ld" rows="2">${esc(l.desc)}</textarea></label>
    <div class="f full"><span style="font-weight:600">صورة أو أيقونة (اختياري)</span><div class="row"><span class="lic" id="lprev">${l.img ? `<img alt="" src="${esc(l.img)}">` : ic(lcat(l.cat)[2])}</span><button type="button" class="btn sm" id="limg">${ic('upload')}اختيار صورة</button><button type="button" class="btn sm ghost" id="lrm" ${l.img ? '' : 'hidden'}>إزالة</button><input type="file" accept="image/*" hidden id="lfile"></div></div>
    <label class="f full"><span class="row"><input type="checkbox" id="lfav" ${l.fav ? 'checked' : ''}> إضافة إلى المفضلة</span></label></div>`,
  onMount(m) {
    let img = l.img; m._img = () => img;
    $('#lu', m).addEventListener('blur', () => { const t = $('#lt', m); if (!t.value.trim() && $('#lu', m).value.trim()) t.value = hostOf($('#lu', m).value); });
    $('#lc', m).onchange = () => { if (!img) $('#lprev', m).innerHTML = ic(lcat($('#lc', m).value)[2]); };
    $('#limg', m).onclick = () => $('#lfile', m).click();
    $('#lrm', m).onclick = () => { img = ''; $('#lprev', m).innerHTML = ic(lcat($('#lc', m).value)[2]); $('#lrm', m).hidden = true; };
    $('#lfile', m).onchange = async e => { const f = e.target.files[0]; if (!f) return; try { img = await shrink(f, 160); $('#lprev', m).innerHTML = `<img alt="" src="${img}">`; $('#lrm', m).hidden = false; } catch(err) { App.toast('تعذّرت قراءة الصورة', true); } };
  },
  foot:[{label:'حفظ', cls:'primary', icon:'check', async onClick(api) {
    const m = api.el; const url = App.val(m, '#lu'), title = App.val(m, '#lt');
    if (!url || !title) { App.toast('الرابط والعنوان مطلوبان', true); return false; }
    if (App.safeUrl(url) === '#') { App.toast('الرابط غير صالح', true); return false; }
    await Store.put('links', Object.assign({}, l, {url: App.safeUrl(url), title, cat: $('#lc', m).value, folder: $('#lf', m).value, desc: App.val(m, '#ld'), fav: $('#lfav', m).checked, img: m._img()}));
    App.toast(link ? 'تم تحديث الرابط' : 'تمت إضافة الرابط');
  }}, '|', ...(link ? [{label:'حذف', cls:'ghost danger', icon:'trash', async onClick() { if (!(await App.confirm('حذف هذا الرابط؟'))) return false; await Store.del('links', link.id); App.toast('تم الحذف'); }}] : [])]});
};
function shrink(file, size) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); const s = Math.min(1, size / Math.max(im.width, im.height)); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL('image/webp', .85)); }; im.onerror = rej; im.src = r.result; }; r.onerror = rej; r.readAsDataURL(file); }); }
const folderMgr = (coll, title) => {
  const draw = () => S[coll].length ? S[coll].map(f => `<div class="item"><span class="body t">${esc(f.name)}</span><button class="icon-btn sm" data-ren="${f.id}" aria-label="إعادة تسمية">${ic('edit')}</button><button class="icon-btn sm" data-rmf="${f.id}" aria-label="حذف">${ic('trash')}</button></div>`).join('') : '<p class="muted small">لا مجلدات بعد.</p>';
  App.modal({title, body:`<div class="row" style="margin-bottom:12px"><input id="nf" placeholder="اسم المجلد، مثال: لغتي - الصف الثالث"><button class="btn primary" id="nfb">${ic('plus')}إضافة</button></div><div class="items" id="fl">${draw()}</div>`, foot:false, onMount(m) {
    const add = async () => { const n = App.val(m, '#nf'); if (!n) return; await Store.put(coll, {name: n}); $('#nf', m).value = ''; setTimeout(() => $('#fl', m).innerHTML = draw(), 50); };
    $('#nfb', m).onclick = add; $('#nf', m).onkeydown = e => { if (e.key === 'Enter') add(); };
    $('#fl', m).onclick = async e => {
      const r = e.target.closest('[data-ren]'), d = e.target.closest('[data-rmf]');
      if (r) { const f = S[coll].find(x => x.id === r.dataset.ren); const n = await App.prompt('إعادة تسمية المجلد', f.name, 'الاسم الجديد'); if (n) { await Store.put(coll, Object.assign({}, f, {name: n})); setTimeout(() => $('#fl', m).innerHTML = draw(), 50); } }
      if (d) { if (!(await App.confirm('حذف المجلد؟ العناصر بداخله لن تُحذف وستصبح بدون مجلد.'))) return; const id = d.dataset.rmf; await Store.del(coll, id); const items = coll === 'lfolders' ? 'links' : 'files'; for (const it of S[items].filter(x => x.folder === id)) await Store.put(items, Object.assign({}, it, {folder: ''})); setTimeout(() => $('#fl', m).innerHTML = draw(), 50); }
    };
  }});
};
App.view('links', {title:'الروابط والموارد', render(el) {
  const u = App.ui.links;
  el.innerHTML = `<div class="toolbar"><div class="search grow">${ic('search')}<input id="lq" placeholder="ابحثي بالعنوان أو الوصف أو الرابط" value="${esc(u.q)}"></div><button class="btn ${u.fav ? 'primary' : ''}" id="lfavB">${ic('star')}المفضلة</button><button class="btn" id="lfo">${ic('folder')}المجلدات</button><button class="btn primary" id="lAdd">${ic('plus')}رابط جديد</button></div>
  <div class="folders"><button class="chip ${!u.folder ? 'on' : ''}" data-fd="">كل المجلدات</button>${S.lfolders.map(f => `<button class="chip ${u.folder === f.id ? 'on' : ''}" data-fd="${f.id}">${ic('folder')}${esc(f.name)} <span class="muted">${S.links.filter(l => l.folder === f.id).length}</span></button>`).join('')}</div>
  <div class="chips" style="margin-bottom:16px"><button class="chip ${!u.cat ? 'on' : ''}" data-ct="">الكل</button>${K.LINK_CATS.map(c => `<button class="chip ${u.cat === c[0] ? 'on' : ''}" data-ct="${c[0]}">${ic(c[2])}${c[1]}</button>`).join('')}</div><div id="lb"></div>`;
  const draw = () => {
    const q = u.q.trim().toLowerCase(); const b = $('#lb', el);
    const list = S.links.filter(l => (!u.cat || l.cat === u.cat) && (!u.folder || l.folder === u.folder) && (!u.fav || l.fav) && (!q || (l.title + ' ' + (l.desc || '') + ' ' + l.url).toLowerCase().includes(q))).sort((a, b) => (b.fav - a.fav) || (b.createdAt || 0) - (a.createdAt || 0));
    if (!S.links.length) { b.innerHTML = App.empty('link', 'مكتبتك فارغة', 'احفظي روابط الألعاب التفاعلية والمسابقات والمنصات وأدوات الذكاء الاصطناعي في مكان واحد.', `<button class="btn primary" data-new>${ic('plus')}أول رابط</button>`); $('[data-new]', b).onclick = () => App.editLink(); return; }
    b.innerHTML = list.length ? `<div class="grid cols-auto">${list.map(l => { const c = lcat(l.cat); const fd = S.lfolders.find(f => f.id === l.folder); return `<div class="lcard"><div class="hd"><span class="lic">${l.img ? `<img alt="" src="${esc(l.img)}">` : ic(c[2])}</span><div style="flex:1;min-width:0"><div class="t">${esc(l.title)}</div><div class="u">${esc(hostOf(l.url))}</div></div><button class="icon-btn sm fav ${l.fav ? 'on' : ''}" data-fav="${l.id}" aria-label="مفضلة">${ic('star')}</button></div>${l.desc ? `<p>${esc(l.desc)}</p>` : ''}<div class="row wrap" style="gap:6px"><span class="badge">${esc(c[1])}</span>${fd ? `<span class="badge">${ic('folder')}${esc(fd.name)}</span>` : ''}</div><div class="ft"><a class="btn sm primary" href="${esc(App.safeUrl(l.url))}" target="_blank" rel="noopener">فتح الرابط</a><button class="icon-btn sm" data-cp="${l.id}" aria-label="نسخ الرابط">${ic('copy')}</button><button class="icon-btn sm" data-ed="${l.id}" aria-label="تعديل">${ic('edit')}</button><button class="icon-btn sm" data-rm="${l.id}" aria-label="حذف">${ic('trash')}</button></div></div>`; }).join('')}</div>` : App.empty('search', 'لا نتائج', 'غيّري التصنيف أو كلمة البحث.');
    $$('[data-fav]', b).forEach(x => x.onclick = () => { const l = S.links.find(y => y.id === x.dataset.fav); Store.put('links', Object.assign({}, l, {fav: !l.fav})); });
    $$('[data-ed]', b).forEach(x => x.onclick = () => App.editLink(S.links.find(y => y.id === x.dataset.ed)));
    $$('[data-rm]', b).forEach(x => x.onclick = async () => { if (await App.confirm('حذف هذا الرابط؟')) { await Store.del('links', x.dataset.rm); App.toast('تم الحذف'); } });
    $$('[data-cp]', b).forEach(x => x.onclick = async () => { const l = S.links.find(y => y.id === x.dataset.cp); try { await navigator.clipboard.writeText(l.url); App.toast('تم نسخ الرابط'); } catch(e) { App.toast('تعذّر النسخ', true); } });
  };
  draw();
  $('#lq', el).oninput = e => { u.q = e.target.value; draw(); };
  $('#lfavB', el).onclick = () => { u.fav = !u.fav; App.render(); };
  $('#lfo', el).onclick = () => folderMgr('lfolders', 'مجلدات الروابط');
  $('#lAdd', el).onclick = () => App.editLink();
  $$('[data-fd]', el).forEach(b => b.onclick = () => { u.folder = b.dataset.fd; App.render(); });
  $$('[data-ct]', el).forEach(b => b.onclick = () => { u.cat = b.dataset.ct; App.render(); });
}});

/* ================= Files ================= */
App.ui.files = {q:'', folder:'', kind:''};
App.uploadDialog = (folder) => {
  folder = folder ?? App.ui.files.folder;
  App.modal({title:'رفع ملفات', body:`<label class="f" style="margin-bottom:14px"><span>المجلد</span><select id="uf"><option value="">بدون مجلد</option>${App.opts(S.ffolders.map(f => [f.id, f.name]), folder)}</select></label><div class="drop" id="drop" tabindex="0" role="button">${ic('upload')}<div style="margin-top:6px"><b>اسحبي الملفات هنا أو اضغطي للاختيار</b></div><div class="small">PDF، Word، Excel، PowerPoint، الصور وغيرها · حتى ${App.fsize(App.MAX_FILE())} للملف</div></div><input type="file" multiple hidden id="ufi"><div id="uprog" class="att-list" style="margin-top:12px"></div>`, foot:false, onMount(m, api) {
    const drop = $('#drop', m), inp = $('#ufi', m);
    drop.onclick = () => inp.click(); drop.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') inp.click(); };
    drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); }; drop.ondragleave = () => drop.classList.remove('over');
    drop.ondrop = e => { e.preventDefault(); drop.classList.remove('over'); go(Array.from(e.dataTransfer.files)); };
    inp.onchange = () => { go(Array.from(inp.files)); inp.value = ''; };
    async function go(files) {
      for (const f of files) {
        const row = document.createElement('div'); row.className = 'a'; row.innerHTML = `<span class="ficon ${App.fileKind(f.name, f.type)}" style="width:30px;height:30px;font-size:9px">${App.fileKind(f.name, f.type).toUpperCase()}</span><span>${esc(f.name)}</span><small class="muted">…</small>`; $('#uprog', m).appendChild(row);
        try { await App.uploadFile(f, $('#uf', m).value, t => $('small', row).textContent = t); $('small', row).textContent = 'تم الحفظ ✓'; }
        catch(e) { $('small', row).textContent = 'فشل'; $('small', row).style.color = 'var(--danger)'; App.toast(e.message || 'تعذّر رفع الملف', true); }
      }
    }
  }});
};
App.previewFile = async f => {
  const api = App.modal({title: f.name, wide:true, body:`<div class="loader"><div class="spin"></div>جارٍ تحميل المعاينة…</div>`, foot:[{label:'تنزيل', cls:'primary', icon:'download', close:false, onClick() { App.downloadFile(f); }}, {label:'فتح في نافذة جديدة', icon:'eye', close:false, async onClick() { const w = window.open('', '_blank'); try { const u = await App.fileUrl(f); if (w) w.location = u; else location.href = u; } catch(e) { if (w) w.close(); App.toast(e.message, true); } }}]});
  const body = $('.mb', api.el);
  try {
    if (f.kind === 'img') body.innerHTML = `<div class="att-view"><img alt="${esc(f.name)}" src="${esc(await App.fileUrl(f))}" style="margin:auto"></div>`;
    else if (f.kind === 'pdf') { let img = null; try { img = await App.pdfImage(f); } catch(e) {} if (img) body.innerHTML = `<div class="att-view"><img alt="${esc(f.name)}" src="${esc(img)}" style="margin:auto;background:#fff"></div><p class="small muted">تظهر هنا الصفحة الأولى من الملف. لعرض كل الصفحات استخدمي «تنزيل».</p>`; else { const url = await App.fileUrl(f); body.innerHTML = `<div class="att-view"><iframe title="${esc(f.name)}" src="${esc(url)}"></iframe></div><p class="small muted">إن لم تظهر المعاينة على جهازك، استخدمي «تنزيل».</p>`; } }
    else if ((f.type || '').startsWith('text/') || /\.(txt|csv|md|json)$/i.test(f.name)) { const t = await (await App.fileBlob(f)).text(); body.innerHTML = `<pre style="white-space:pre-wrap;background:var(--surface2);padding:14px;border-radius:10px;max-height:60vh;overflow:auto">${esc(t.slice(0, 200000))}</pre>`; }
    else body.innerHTML = `<div class="empty"><span class="ficon ${f.kind}" style="margin:0 auto 12px;width:64px;height:64px;font-size:14px">${f.kind.toUpperCase()}</span><b>${esc(f.name)}</b><p>${App.fsize(f.size)} · لا تتوفر معاينة مباشرة لملفات ${({doc:'Word', xls:'Excel', ppt:'PowerPoint'})[f.kind] || 'هذا النوع'} داخل المتصفح. نزّليه لفتحه في التطبيق المناسب.</p></div>`;
  } catch(e) { body.innerHTML = App.empty('alert', 'تعذّرت المعاينة', e.message || ''); }
};
App.view('files', {title:'الملفات', render(el) {
  const u = App.ui.files;
  const used = S.files.reduce((a, f) => a + (f.size || 0), 0);
  el.innerHTML = `<div class="toolbar"><div class="search grow">${ic('search')}<input id="fq" placeholder="ابحثي باسم الملف" value="${esc(u.q)}"></div><select id="fk" style="width:auto;flex:0 1 160px">${App.opts({'':'كل الأنواع', pdf:'PDF', doc:'Word', xls:'Excel', ppt:'PowerPoint', img:'الصور', oth:'أخرى'}, u.kind)}</select><button class="btn" id="ffo">${ic('folder')}المجلدات</button><button class="btn primary" id="fup">${ic('upload')}رفع ملفات</button></div>
  <div class="folders"><button class="chip ${!u.folder ? 'on' : ''}" data-fd="">كل الملفات <span class="muted">${S.files.length}</span></button>${S.ffolders.map(f => `<button class="chip ${u.folder === f.id ? 'on' : ''}" data-fd="${f.id}">${ic('folder')}${esc(f.name)} <span class="muted">${S.files.filter(x => x.folder === f.id).length}</span></button>`).join('')}</div><div id="fb"></div><p class="small muted" style="margin-top:14px">المساحة المستخدمة: ${App.fsize(used)} · الملفات محفوظة في حسابك وخاصة بك.</p>`;
  const draw = () => {
    const q = u.q.trim().toLowerCase(); const b = $('#fb', el);
    const list = S.files.filter(f => (!u.folder || f.folder === u.folder) && (!u.kind || f.kind === u.kind) && (!q || f.name.toLowerCase().includes(q))).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    if (!S.files.length) { b.innerHTML = App.empty('folder', 'لا توجد ملفات بعد', 'ارفعي ملفات PDF وWord وExcel والعروض والصور، ونظّميها في مجلدات.', `<button class="btn primary" data-new>${ic('upload')}رفع أول ملف</button>`); $('[data-new]', b).onclick = () => App.uploadDialog(); return; }
    b.innerHTML = list.length ? `<div class="grid cols-auto">${list.map(f => { const fd = S.ffolders.find(x => x.id === f.folder); return `<div class="lcard"><div class="fthumb" data-th="${f.id}" data-open-file="${f.id}" style="cursor:pointer"><span class="ficon ${f.kind}">${f.kind === 'oth' ? (f.name.split('.').pop() || '').slice(0, 4).toUpperCase() : f.kind.toUpperCase()}</span></div><div><div class="t" style="font-size:15px">${esc(f.name)}</div><div class="small muted">${App.fsize(f.size || 0)} · ${esc(D.short(new Date(f.createdAt)))}${fd ? ' · ' + esc(fd.name) : ''}</div></div><div class="ft"><button class="btn sm" data-open-file="${f.id}">${ic('eye')}معاينة</button><button class="icon-btn sm" data-dl="${f.id}" aria-label="تنزيل">${ic('download')}</button><button class="icon-btn sm" data-ren="${f.id}" aria-label="إعادة تسمية أو نقل">${ic('edit')}</button><button class="icon-btn sm" data-rm="${f.id}" aria-label="حذف">${ic('trash')}</button></div></div>`; }).join('')}</div>` : App.empty('search', 'لا نتائج', 'غيّري البحث أو المجلد.');
    $$('[data-dl]', b).forEach(x => x.onclick = () => App.downloadFile(S.files.find(f => f.id === x.dataset.dl)));
    $$('[data-ren]', b).forEach(x => x.onclick = () => { const f = S.files.find(y => y.id === x.dataset.ren);
      App.modal({title:'إعادة تسمية ونقل', body:`<label class="f" style="margin-bottom:12px"><span>اسم الملف</span><input id="rn" value="${esc(f.name)}"></label><label class="f"><span>المجلد</span><select id="rf"><option value="">بدون مجلد</option>${App.opts(S.ffolders.map(z => [z.id, z.name]), f.folder)}</select></label>`, foot:[{label:'حفظ', cls:'primary', async onClick(api) { const n = App.val(api.el, '#rn'); if (!n) { App.toast('اكتبي اسمًا', true); return false; } await Store.put('files', Object.assign({}, f, {name: n, folder: $('#rf', api.el).value})); App.toast('تم الحفظ'); }}]}); });
    $$('[data-rm]', b).forEach(x => x.onclick = async () => { const f = S.files.find(y => y.id === x.dataset.rm); if (!(await App.confirm(`حذف «${f.name}» نهائيًا؟`))) return; try { await App.deleteFile(f); App.toast('تم حذف الملف'); } catch(e) {} });
    $$('[data-th]', b).forEach(box => { const f = S.files.find(x => x.id === box.dataset.th); if (f && (f.kind === 'img' || f.kind === 'pdf')) App.fillThumb(box, f, f.kind === 'pdf' ? 'contain' : 'cover'); });
  };
  draw();
  $('#fq', el).oninput = e => { u.q = e.target.value; draw(); };
  $('#fk', el).onchange = e => { u.kind = e.target.value; draw(); };
  $('#ffo', el).onclick = () => folderMgr('ffolders', 'مجلدات الملفات');
  $('#fup', el).onclick = () => App.uploadDialog();
  $$('[data-fd]', el).forEach(b => b.onclick = () => { u.folder = b.dataset.fd; App.render(); });
}});

/* ================= Notes ================= */
const NT = {daily:'ملاحظة يومية', idea:'فكرة', initiative:'فكرة مبادرة', meeting:'ملاحظات اجتماع', check:'قائمة تحقق'};
App.ui.notes = {q:'', type:''};
App.editNote = (note, preset={}) => {
  let n = Object.assign({title:'', body:'', type:'daily', items:[], pinned:false}, preset, note ? App.clone(note) : {});
  let saved = !!note;
  App.modal({title: note ? 'تعديل الملاحظة' : 'ملاحظة جديدة', wide:true, body:`<div class="fgrid">
    <label class="f"><span>العنوان</span><input id="nt" value="${esc(n.title)}" placeholder="بدون عنوان"></label>
    <label class="f"><span>النوع</span><select id="ny">${App.opts(NT, n.type)}</select></label>
    <label class="f full"><span>المحتوى</span><textarea id="nb" rows="8" placeholder="اكتبي أفكارك…">${esc(n.body)}</textarea></label>
    <div class="f full checklist" id="nci"><span style="font-weight:600">قائمة تحقق</span>${App.dynList(n.items, {ph:'عنصر', check:true})}</div>
    <label class="f full"><span class="row"><input type="checkbox" id="np" ${n.pinned ? 'checked' : ''}> تثبيت الملاحظة في الأعلى</span></label></div><p class="small muted" id="nst">${note ? 'تُحفظ التعديلات تلقائيًا' : ''}</p>`,
  onMount(m) {
    App.bindDyn(m);
    const collect = () => Object.assign(n, {title: App.val(m, '#nt'), type: $('#ny', m).value, body: $('#nb', m).value, items: App.readDyn($('#nci', m)), pinned: $('#np', m).checked});
    const auto = App.debounce(async () => { collect(); if (!n.title && !n.body.trim() && !n.items.length) return; try { await Store.put('notes', n); saved = true; $('#nst', m).textContent = 'تم الحفظ تلقائيًا ' + D.hm(new Date()); } catch(e) {} }, 900);
    m.addEventListener('input', () => { $('#nst', m).textContent = 'جارٍ الحفظ…'; auto(); });
    m.addEventListener('change', auto);
    m._collect = collect;
  },
  foot:[{label:'حفظ وإغلاق', cls:'primary', icon:'check', async onClick(api) { api.el._collect(); if (!n.title && !n.body.trim() && !n.items.length) { if (!saved) return; } await Store.put('notes', n); }}, '|', ...(note ? [{label:'حذف', cls:'ghost danger', icon:'trash', async onClick() { if (!(await App.confirm('حذف هذه الملاحظة؟'))) return false; await Store.del('notes', note.id); App.toast('تم الحذف'); }}] : [])]});
};
App.view('notes', {title:'المفكرة', render(el) {
  const u = App.ui.notes;
  el.innerHTML = `<div class="toolbar"><div class="search grow">${ic('search')}<input id="nq" placeholder="ابحثي في ملاحظاتك السابقة" value="${esc(u.q)}"></div><button class="btn primary" id="nAdd">${ic('plus')}ملاحظة جديدة</button></div><div class="chips" style="margin-bottom:16px"><button class="chip ${!u.type ? 'on' : ''}" data-ty="">الكل</button>${Object.entries(NT).map(([k, l]) => `<button class="chip ${u.type === k ? 'on' : ''}" data-ty="${k}">${l}</button>`).join('')}</div><div id="nbx"></div>`;
  const draw = () => {
    const q = u.q.trim(); const b = $('#nbx', el);
    const list = S.notes.filter(n => (!u.type || n.type === u.type) && (!q || (n.title + ' ' + n.body + ' ' + (n.items || []).map(i => i.text).join(' ')).includes(q))).sort((a, b) => (b.pinned - a.pinned) || (b.updatedAt || 0) - (a.updatedAt || 0));
    if (!S.notes.length) { b.innerHTML = App.empty('note', 'المفكرة فارغة', 'دوّني ملاحظاتك اليومية وأفكار المبادرات وملاحظات الاجتماعات وقوائم التحقق.', `<button class="btn primary" data-new>${ic('plus')}أول ملاحظة</button>`); $('[data-new]', b).onclick = () => App.editNote(); return; }
    b.innerHTML = list.length ? `<div class="grid cols-auto">${list.map(n => { const it = n.items || []; return `<div class="note ${n.pinned ? 'pinned' : ''}" data-note="${n.id}"><div class="row between" style="align-items:flex-start"><div class="t">${esc(n.title || 'بدون عنوان')}</div><button class="icon-btn sm fav ${n.pinned ? 'on' : ''}" data-pin="${n.id}" aria-label="تثبيت">${ic('pin')}</button></div>${n.body ? `<div class="x">${esc(n.body)}</div>` : ''}${it.length ? `<div class="small muted">${ic('check')} ${it.filter(i => i.done).length}/${it.length} عناصر</div>` : ''}<div class="row between small muted" style="margin-top:auto"><span class="badge">${NT[n.type] || ''}</span><span>${esc(D.short(new Date(n.updatedAt || n.createdAt)))}</span></div></div>`; }).join('')}</div>` : App.empty('search', 'لا نتائج', 'جرّبي كلمة أخرى.');
    $$('[data-note]', b).forEach(c => c.onclick = e => { if (e.target.closest('[data-pin]')) return; App.editNote(S.notes.find(x => x.id === c.dataset.note)); });
    $$('[data-pin]', b).forEach(x => x.onclick = () => { const n = S.notes.find(y => y.id === x.dataset.pin); Store.put('notes', Object.assign({}, n, {pinned: !n.pinned})); });
  };
  draw();
  $('#nq', el).oninput = e => { u.q = e.target.value; draw(); };
  $('#nAdd', el).onclick = () => App.editNote(u.type ? null : null, u.type ? {type: u.type} : {});
  $$('[data-ty]', el).forEach(b => b.onclick = () => { u.type = b.dataset.ty; App.render(); });
}});

/* ================= Notifications ================= */
App.view('notifications', {title:'الإشعارات', render(el) {
  const items = S.notifs.items || [];
  const perm = 'Notification' in window ? Notification.permission : 'unsupported';
  el.innerHTML = `<div class="toolbar"><span class="grow small muted">${items.length ? `${App.unread()} غير مقروءة من ${items.length}` : ''}</span>${perm === 'default' ? `<button class="btn" id="nperm">${ic('bell')}تفعيل إشعارات الجهاز</button>` : ''}${items.length ? `<button class="btn" id="nall">${ic('check')}تحديد الكل كمقروء</button><button class="btn ghost danger" id="nclr">${ic('trash')}مسح المقروءة</button>` : ''}</div>
  ${perm === 'denied' ? `<div class="card small muted" style="margin-bottom:14px">إشعارات المتصفح مرفوضة لهذا الموقع. ستصلك التنبيهات داخل المنصة فقط.</div>` : ''}
  ${items.length ? `<div class="items">${items.map(n => `<div class="notif ${n.read ? '' : 'unread'} ${n.kind === 'due' ? 'due' : ''}"><span class="ic">${ic(n.kind === 'due' ? 'alert' : n.kind === 'class' ? 'grid' : 'bell')}</span><div><b>${esc(n.title)}</b>${n.body ? `<div class="small muted">${esc(n.body)}</div>` : ''}<div class="small muted" style="margin-top:4px">${esc(D.fmtDT(D.ymd(new Date(n.at)) + 'T' + D.hm(new Date(n.at))))}${n.important ? ' · <span class="badge high">مهم</span>' : ''}</div></div><div class="row" style="gap:2px;align-self:flex-start">${n.ref ? `<button class="btn sm" data-go="${esc(n.ref)}">عرض</button>` : ''}${!n.read ? `<button class="icon-btn sm" data-rd="${n.id}" aria-label="مقروء">${ic('check')}</button>` : ''}</div></div>`).join('')}</div>` : App.empty('bell', 'لا إشعارات', 'ستظهر هنا تنبيهات اقتراب مواعيد المهام وانتهائها والمواعيد والحصص.')}`;
  const np = $('#nperm', el); if (np) np.onclick = App.askPerm;
  const na = $('#nall', el); if (na) na.onclick = () => App.markRead('all');
  const nc = $('#nclr', el); if (nc) nc.onclick = async () => { S.notifs = {items: items.filter(n => !n.read)}; App.flush(); await App.saveMeta('notifs', S.notifs); };
  $$('[data-rd]', el).forEach(b => b.onclick = () => App.markRead([b.dataset.rd]));
  $$('[data-go]', el).forEach(b => b.onclick = () => { const [k, id] = b.dataset.go.split(':'); if (k === 'task') App.showTask(id); else if (k === 'event') App.editEvent(S.events.find(e => e.id === id)); else App.go(k); });
  // opening the centre marks everything visible as seen (important ones stay until acknowledged)
  const seen = items.filter(n => !n.read && !n.important).map(n => n.id); if (seen.length) setTimeout(() => App.markRead(seen), 1500);
}});
App.askPerm = async () => {
  if (!('Notification' in window)) { App.toast('المتصفح لا يدعم الإشعارات', true); return; }
  try { const r = await Notification.requestPermission(); App.toast(r === 'granted' ? 'تم تفعيل إشعارات الجهاز' : 'لم يُمنح الإذن؛ ستبقى التنبيهات داخل المنصة', r !== 'granted'); App.render(); }
  catch(e) { App.toast('هذا العرض لا يسمح بإشعارات الجهاز؛ ستصلك داخل المنصة', true); }
};

/* ================= Account & themes ================= */
App.profileForm = p => `<div class="fgrid">
  <label class="f full"><span>الاسم الكامل *</span><input id="pfn" value="${esc(p.name || '')}" autocomplete="name"></label>
  <label class="f"><span>اسم المدرسة</span><input id="pfs" value="${esc(p.school || '')}"></label>
  <label class="f"><span>التخصص أو المادة</span><input id="pfj" value="${esc(p.subject || '')}" placeholder="مثال: لغتي"></label>
  <label class="f"><span>المرحلة الدراسية</span><select id="pfg"><option value="">اختاري</option>${App.opts(K.STAGES, p.stage)}</select></label>
  <label class="f"><span>البريد الإلكتروني (اختياري)</span><input id="pfe" type="email" dir="ltr" value="${esc(p.email || '')}" autocomplete="email"></label></div>`;
App.readProfile = m => ({name: App.val(m, '#pfn'), school: App.val(m, '#pfs'), subject: App.val(m, '#pfj'), stage: $('#pfg', m).value, email: App.val(m, '#pfe')});
App.view('account', {title:'حسابي والثيمات', render(el) {
  const p = S.profile || {}; const cfg = S.config; const cur = document.getElementById('app').dataset.t;
  const themes = K.THEMES.filter(t => !cfg.themes || cfg.themes.includes(t.id));
  const perm = 'Notification' in window ? Notification.permission : 'unsupported';
  el.innerHTML = `<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));align-items:start">
  <div class="card"><h3>${ic('user')}البيانات الشخصية</h3><form id="pf">${App.profileForm(p)}<div class="row" style="margin-top:16px"><button class="btn primary" type="submit">${ic('check')}حفظ البيانات</button></div></form></div>
  <div class="card"><h3>${ic('palette')}الثيم والمظهر</h3><p class="small muted" style="margin-top:0">يتغير مظهر المنصة كاملًا ويُحفظ اختيارك في حسابك على كل أجهزتك.</p><div class="themes">${themes.map(t => `<button class="th ${cur === t.id ? 'on' : ''}" data-th="${t.id}" aria-pressed="${cur === t.id}"><div class="pv" style="background:${t.c[0]}"><i style="background:${t.c[1]};border-inline-end:1px solid rgba(0,0,0,.06)"></i><div><span style="background:${t.c[2]};width:60%"></span><span style="background:${t.c[3]};opacity:.25;width:85%"></span><span style="background:${t.c[3]};opacity:.15;width:70%"></span></div></div><b>${t.name}<br><span class="small muted" style="font-weight:500">${t.ar}</span></b></button>`).join('')}</div>
  ${cfg.allowCustom !== false ? `<div class="row wrap" style="margin-top:16px"><label class="row" style="font-weight:600">لون مخصص <input type="color" id="acc" value="${esc(p.accent || getComputedStyle(document.getElementById('app')).getPropertyValue('--accent').trim() || '#2f5bea')}"></label>${p.accent ? `<button class="btn sm ghost" id="accR">استعادة لون الثيم</button>` : ''}</div>` : ''}</div>
  <div class="card"><h3>${ic('bell')}التنبيهات</h3><p class="small muted" style="margin-top:0">تصلك التنبيهات داخل المنصة دائمًا. ويمكن تفعيل إشعارات المتصفح والجهاز إن سمح المتصفح بذلك أثناء فتح المنصة.</p><div class="row wrap"><span class="badge ${perm === 'granted' ? 'low' : ''}">${({granted:'إشعارات الجهاز مفعلة', denied:'إشعارات الجهاز مرفوضة', default:'إشعارات الجهاز غير مفعلة', unsupported:'المتصفح لا يدعم إشعارات الجهاز'})[perm]}</span>${perm === 'default' ? `<button class="btn sm" id="perm">تفعيل</button>` : ''}<button class="btn sm ghost" id="testN">إشعار تجريبي</button></div>
    <label class="f" style="margin-top:14px"><span>تنبيه قبل بداية الحصة</span><select id="clsR">${App.opts([['-1','بدون'],['5','قبل 5 دقائق'],['10','قبل 10 دقائق'],['15','قبل 15 دقيقة']], String(p.classRemind ?? -1))}</select></label></div>
  <div class="card"><h3>${ic('spark')}تعبئة الجدول من صورة</h3><p class="small muted" style="margin-top:0">ميزة اختيارية: ترفعين صورة جدولك فتُقرأ الحصص منها وتعبّأ في الجدول، ثم تراجعينها قبل الحفظ. اختاري الطريقة التي تناسبك، ويظهر زرها وحده في صفحة الجداول.</p>
    <div class="items" id="fillM">${[['off','إيقاف الميزة','لا يظهر زر التعبئة التلقائية.'],['ocr','قراءة مجانية داخل المتصفح','بدون تكلفة وتعمل على جهازك. دقتها متوسطة، وقد تحتاج تعديل بعض الخانات.'],['ai','قراءة بالذكاء الاصطناعي (Claude)', S.config.aiFill ? `أدق بكثير في قراءة الجداول العربية. الحد اليومي: ${S.config.aiDailyLimit || 5} صور.` : 'غير مفعّلة حاليًا من المطور.']].map(([k, t, d]) => `<label class="item" style="cursor:pointer;${k === 'ai' && !S.config.aiFill ? 'opacity:.55;cursor:not-allowed' : ''}"><input type="radio" name="fm" value="${k}" ${(p.fillMethod || 'off') === k ? 'checked' : ''} ${k === 'ai' && !S.config.aiFill ? 'disabled' : ''} style="width:20px;height:20px;min-height:0;margin-top:3px;accent-color:var(--accent)"><span class="body"><span class="t">${t}</span><span class="small muted" style="display:block">${d}</span></span></label>`).join('')}</div></div>
  <div class="card"><h3>${ic('download')}بياناتي</h3><p class="small muted" style="margin-top:0">بياناتك خاصة بحسابك ولا يطّلع عليها أي مستخدم آخر. يمكنك تنزيل نسخة احتياطية منها.</p><div class="row wrap"><button class="btn" id="exp">${ic('download')}تنزيل نسخة احتياطية (JSON)</button><button class="btn" id="imp">${ic('upload')}استيراد بيانات (JSON)</button><input type="file" accept=".json,application/json" hidden id="impF">${hasDemo() ? `<button class="btn ghost danger" id="rmDemo">${ic('trash')}حذف البيانات التجريبية</button>` : ''}</div><p class="small muted">الاستيراد يضيف العناصر إلى بياناتك الحالية ولا يحذف شيئًا. يصلح لاسترجاع نسخة احتياطية أو لتجربة المنصة ببيانات نموذجية.</p><p class="small muted">وضع التخزين: ${Store.mode === 'cloud' ? 'سحابي متزامن بين الأجهزة' : 'تجريبي على هذا المتصفح فقط'}</p></div>
  <div class="card"><h3>${ic('user')}الحساب والتطبيق</h3>${App.isCodeAccount && App.isCodeAccount() ? `<p class="small" style="margin-top:0">تدخلين باسمك <b>${esc(p.loginName || p.name)}</b> ورقمك السري من أي جهاز. اكتبي الاسم بنفس الطريقة دائمًا.</p>` : S.email ? `<p class="small muted" style="margin-top:0">مسجّلة الدخول بـ <span dir="ltr">${esc(S.email)}</span></p>` : ''}<div class="row wrap">${App.canInstall ? `<button class="btn primary" id="inst">${ic('download')}تثبيت المنصة كتطبيق</button>` : ''}${Store.mode === 'cloud' ? `<button class="btn" id="chpw">${App.isCodeAccount && App.isCodeAccount() ? 'تغيير الرقم السري' : 'تغيير كلمة المرور'}</button>` : ''}${Store.mode === 'cloud' ? `<button class="btn ghost danger" id="out">${ic('logout')}تسجيل الخروج</button>` : ''}</div><p class="small muted">للتثبيت على iPhone وiPad: افتحي المنصة في Safari ← زر المشاركة ← «إضافة إلى الشاشة الرئيسية». وعلى Android والكمبيوتر يظهر زر التثبيت هنا أو في شريط العنوان.</p></div></div>`;
  $('#pf', el).onsubmit = async e => { e.preventDefault(); const v = App.readProfile(el); if (!v.name) { App.toast('الاسم مطلوب', true); return; } await App.saveProfile(v); App.toast('تم حفظ البيانات'); };
  $$('[data-th]', el).forEach(b => b.onclick = async () => { await App.saveProfile({theme: b.dataset.th, accent: ''}); App.render(); App.toast('تم تطبيق الثيم'); });
  const acc = $('#acc', el); if (acc) { const save = App.debounce(v => App.saveProfile({accent: v}), 400); acc.oninput = () => { document.getElementById('app').style.setProperty('--accent', acc.value); }; acc.onchange = () => { save(acc.value); }; }
  const ar = $('#accR', el); if (ar) ar.onclick = async () => { await App.saveProfile({accent: ''}); App.render(); };
  const pm = $('#perm', el); if (pm) pm.onclick = App.askPerm;
  $('#testN', el).onclick = () => App.notify({title:'إشعار تجريبي', body:'هكذا ستصلك التنبيهات.', kind:'info'});
  $('#clsR', el).onchange = e => App.saveProfile({classRemind: +e.target.value});
  $('#imp', el).onclick = () => $('#impF', el).click();
  $('#impF', el).onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (f) importData(f); };
  const rd = $('#rmDemo', el); if (rd) rd.onclick = async () => {
    if (!(await App.confirm('حذف كل العناصر التجريبية المستوردة؟ بياناتك الأخرى لن تتأثر.'))) return;
    let n = 0; for (const c of IMPORTABLE) for (const it of S[c].filter(x => String(x.id).startsWith('demo-'))) { await Store.del(c, it.id); n++; }
    App.toast(`تم حذف ${n} عنصرًا تجريبيًا`); App.render();
  };
  $$('#fillM input', el).forEach(r => r.onchange = () => App.saveProfile({fillMethod: r.value}).then(() => App.toast('تم الحفظ')));
  const ins = $('#inst', el); if (ins) ins.onclick = () => App.install();
  const out = $('#out', el); if (out) out.onclick = () => App.signOut();

  const cp = $('#chpw', el); if (cp) cp.onclick = () => { const pinMode = App.isCodeAccount && App.isCodeAccount();
    App.modal({title: pinMode ? 'تغيير الرقم السري' : 'تغيير كلمة المرور', body: pinMode ? `<label class="f"><span>الرقم السري الجديد (4 أرقام)</span><input id="np1" type="password" inputmode="numeric" maxlength="4" autocomplete="off" style="text-align:center;letter-spacing:.5em;font-size:22px;font-weight:700"></label>` : `<label class="f"><span>كلمة المرور الجديدة</span><input type="password" id="np1" minlength="8" autocomplete="new-password" placeholder="8 أحرف على الأقل"></label>`,
    foot:[{label:'حفظ', cls:'primary', async onClick(api) { const v2 = $('#np1', api.el).value.trim();
      if (pinMode) { if (!/^\d{4}$/.test(v2)) { App.toast('4 أرقام', true); return false; } try { await App.changePin(v2); } catch(e) { App.toast('تعذّر التغيير', true); return false; } App.toast('تم تغيير الرقم السري'); return; }
      if (v2.length < 8) { App.toast('8 أحرف على الأقل', true); return false; } const {error} = await Store.sb.auth.updateUser({password: v2}); if (error) { App.toast('تعذّر التغيير: ' + error.message, true); return false; } App.toast('تم تغيير كلمة المرور'); }}]}); };
  $('#exp', el).onclick = () => { const data = {exportedAt: new Date().toISOString(), profile: S.profile}; ['tasks','events','links','lfolders','schedules','plans','notes','files','ffolders'].forEach(k => data[k] = S[k]); App.save('teacher-hub-backup-' + D.ymd(new Date()) + '.json', JSON.stringify(data, null, 2)); };
}});

const IMPORTABLE = ['tasks','events','links','lfolders','schedules','plans','notes','ffolders'];
const hasDemo = () => IMPORTABLE.some(c => S[c].some(x => String(x.id).startsWith('demo-')));
async function importData(file) {
  let data; try { data = JSON.parse(await file.text()); } catch(e) { App.toast('الملف ليس بصيغة JSON صحيحة', true); return; }
  const counts = IMPORTABLE.map(c => [c, Array.isArray(data[c]) ? data[c].filter(x => x && typeof x === 'object').length : 0]).filter(x => x[1]);
  if (!counts.length) { App.toast('لم أجد بيانات قابلة للاستيراد في الملف', true); return; }
  const names = {tasks:'مهام', events:'مواعيد', links:'روابط', lfolders:'مجلدات روابط', schedules:'جداول', plans:'خطط', notes:'ملاحظات', ffolders:'مجلدات ملفات'};
  if (!(await App.confirm('سيتم استيراد: ' + counts.map(([c, n]) => `${n} ${names[c]}`).join('، ') + '.', 'استيراد', false))) return;
  App.toast('جارٍ الاستيراد…'); let n = 0;
  try {
    if (Array.isArray(data.schedules) && data.schedules.some(s => s.main) && S.schedules.some(s => s.main)) data.schedules.forEach(s => s.main = false);
    for (const [c] of counts) for (const it of data[c]) { if (!it || typeof it !== 'object') continue; const o = App.clone(it); delete o.al; if (!o.id || !/^[\w\-.~:@+]{1,120}$/.test(o.id)) o.id = App.rid(); await Store.put(c, o); n++; }
    App.toast(`تم استيراد ${n} عنصرًا`); App.go('dashboard');
  } catch(e) { App.toast('توقف الاستيراد بعد ' + n + ' عنصرًا', true); }
}

/* ================= Onboarding ================= */
App.onboarding = el => {
  el.innerHTML = `<div class="onb card"><h2>مرحبًا بكِ في مكتبك الرقمي</h2><p class="muted">عرّفينا بنفسك لتظهر بياناتك في لوحة التحكم. يمكنك تعديلها لاحقًا من «حسابي».</p><form id="ob">${App.profileForm({})}<button class="btn primary" style="margin-top:18px;width:100%" type="submit">${ic('check')}ابدئي الآن</button></form></div>`;
  $('#ob', el).onsubmit = async e => { e.preventDefault(); const v = App.readProfile(el); if (!v.name) { App.toast('اكتبي اسمك الكامل', true); $('#pfn', el).focus(); return; } try { await App.saveProfile(Object.assign(v, {createdAt: Date.now()})); App.toast('أهلًا ' + v.name.split(' ')[0]); App.go('dashboard'); } catch(err) {} };
};

/* ================= About ================= */
App.view('about', {title:'حول المنصة', render(el) {
  const c = S.config;
  el.innerHTML = `<div class="card" style="max-width:760px"><div class="row" style="margin-bottom:12px"><span class="lic" style="width:56px;height:56px">${ic('book')}</span><div><h2 style="margin:0;font-size:24px">منظّم المعلم · Teacher Hub</h2><div class="muted small">الإصدار ${esc(c.version || '1.0.0')}</div></div></div>
  <p class="prose">${esc(c.about || 'مكتب رقمي شخصي للمعلم والمعلمة يجمع المهام والجداول والخطط والروابط والملفات والمواعيد والتنبيهات والملاحظات في مكان واحد.')}</p>
  <dl class="kv" style="margin-top:16px"><dt>تطوير وتصميم</dt><dd>${esc(c.devName || '—')}</dd><dt>الحقوق</dt><dd>© ${new Date().getFullYear()} ${esc(c.copyright || '')}</dd><dt>الخصوصية</dt><dd>بيانات كل معلم خاصة بحسابه، ولا يطّلع عليها أي مستخدم آخر.</dd></dl>
  ${(c.releases || []).length ? `<div class="section" style="margin-top:20px"><h4>سجل الإصدارات</h4>${c.releases.slice().reverse().map(r => `<div style="margin-bottom:10px"><b>${esc(r.v)}</b> <span class="small muted">${esc(r.date || '')}</span><div class="prose small">${esc(r.notes || '')}</div></div>`).join('')}</div>` : ''}</div>`;
}});

/* ================= Developer admin ================= */
App.view('admin', {title:'لوحة المطور', guard: () => S.isOwner, render(el) {
  if (App.registry == null) { el.innerHTML = '<div class="loader"><div class="spin"></div>جارٍ تحميل بيانات المستخدمين…</div>'; if (!App._regLoading) { App._regLoading = true; App.loadRegistry().finally(() => { App._regLoading = false; }); } return; }
  const rows = (App.registry || []).slice().sort((a, b) => (b.lastActive || 0) - (a.lastActive || 0)); const c = S.config;
  const schools = {}; rows.forEach(r => { const k = r.school || 'غير محدد'; schools[k] = (schools[k] || 0) + 1; });
  const sum = k => rows.reduce((a, r) => a + ((r.counts || {})[k] || 0), 0);
  const active7 = rows.filter(r => Date.now() - (r.lastActive || 0) < 7 * 86400000).length;
  const thc = {}; rows.forEach(r => { if (r.theme) thc[r.theme] = (thc[r.theme] || 0) + 1; });
  el.innerHTML = `<div class="card small" style="margin-bottom:16px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">${ic('shield')}<span style="flex:1 1 240px">هذه الصفحة لا تظهر إلا للمطور، وبياناتها محمية بصلاحيات على الخادم (Row Level Security) تمنع أي حساب آخر من قراءتها. أما المهام والملفات والملاحظات فخاصة بكل معلم ولا تُعرض هنا.</span>${Store.mode === 'cloud' ? `<button class="btn sm" id="adRef">تحديث</button>` : ''}<button class="btn sm primary" id="adRep">${ic('printer')}تقرير للمديرة</button></div>
  ${Store.mode !== 'cloud' ? `<div class="card" style="margin-bottom:16px">${App.empty('alert', 'وضع التجربة', 'تظهر بيانات المستخدمين بعد ربط المنصة بقاعدة البيانات.')}</div>` : ''}
  <div class="stat-row"><div class="stat"><b>${rows.length}</b><span>المستخدمون المسجلون</span></div><div class="stat"><b>${active7}</b><span>نشطون خلال 7 أيام</span></div><div class="stat"><b>${Object.keys(schools).length}</b><span>المدارس</span></div><div class="stat"><b>${sum('tasks')}</b><span>إجمالي المهام (${sum('done')} مكتملة)</span></div></div>
  <div class="card" style="margin-bottom:16px"><h3>${ic('user')}المستخدمون</h3>${rows.length ? `<div class="tbl-wrap"><table class="data stack"><thead><tr><th>الاسم</th><th>المدرسة</th><th>المادة</th><th>المرحلة</th><th>البريد</th><th>التسجيل</th><th>آخر نشاط</th><th>مهام</th><th>خطط</th><th>ملفات</th></tr></thead><tbody>${rows.map(r => `<tr><td data-l="الاسم"><b>${esc(r.name)}</b></td><td data-l="المدرسة">${esc(r.school)}</td><td data-l="المادة">${esc(r.subject)}</td><td data-l="المرحلة">${esc(r.stage)}</td><td data-l="البريد" dir="ltr">${esc(r.email)}</td><td data-l="التسجيل">${r.joined ? esc(D.short(new Date(r.joined))) : ''}</td><td data-l="آخر نشاط">${r.lastActive ? esc(D.fmtDT(D.ymd(new Date(r.lastActive)) + 'T' + D.hm(new Date(r.lastActive)))) : ''}</td><td class="n" data-l="مهام">${(r.counts || {}).tasks || 0}</td><td class="n" data-l="خطط">${(r.counts || {}).plans || 0}</td><td class="n" data-l="ملفات">${(r.counts || {}).files || 0}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted small">لم يسجّل أي مستخدم بعد.</p>'}</div>
  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr));align-items:start">
    <div class="card"><h3>${ic('home')}المدارس</h3>${Object.keys(schools).length ? `<div class="hbars">${Object.entries(schools).sort((a, b) => b[1] - a[1]).map(([s, n]) => `<div class="r"><span title="${esc(s)}" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(s)}</span><div class="bar"><i style="width:${n / rows.length * 100}%"></i></div><span>${n}</span></div>`).join('')}</div>` : '<p class="muted small">لا بيانات.</p>'}</div>
    <div class="card"><h3>${ic('sliders')}إحصائيات الاستخدام</h3><dl class="kv"><dt>المهام</dt><dd>${sum('tasks')}</dd><dt>الخطط</dt><dd>${sum('plans')}</dd><dt>المواعيد</dt><dd>${sum('events')}</dd><dt>الجداول</dt><dd>${sum('schedules')}</dd><dt>الروابط</dt><dd>${sum('links')}</dd><dt>الملفات</dt><dd>${sum('files')}</dd><dt>الملاحظات</dt><dd>${sum('notes')}</dd><dt>الثيمات المستخدمة</dt><dd>${Object.entries(thc).map(([t, n]) => `${esc((K.THEMES.find(x => x.id === t) || {}).name || t)} (${n})`).join('، ') || '—'}</dd></dl></div>
    <div class="card"><h3>${ic('palette')}إدارة الثيمات العامة</h3><label class="f" style="margin-bottom:12px"><span>الثيم الافتراضي للمستخدمين الجدد</span><select id="adT">${App.opts(K.THEMES.map(t => [t.id, t.name]), c.defaultTheme)}</select></label><div class="f"><span style="font-weight:600">الثيمات المتاحة للمعلمين</span><div class="chips" id="adTh">${K.THEMES.map(t => `<button class="chip ${(c.themes || []).includes(t.id) ? 'on' : ''}" data-t="${t.id}">${t.name}</button>`).join('')}</div></div><label class="row" style="margin-top:12px"><input type="checkbox" id="adC" ${c.allowCustom !== false ? 'checked' : ''}> السماح باللون المخصص</label><button class="btn primary" id="adTS" style="margin-top:14px">حفظ إعدادات الثيمات</button></div>
    <div class="card"><h3>${ic('bell')}إعدادات النظام</h3><label class="f" style="margin-bottom:12px"><span>إعلان عام يظهر لجميع المعلمين</span><textarea id="adA" rows="2">${esc(c.announce)}</textarea></label><label class="f"><span>رسالة صيانة (اتركيها فارغة لإخفائها)</span><input id="adM" value="${esc(c.maintenance)}"></label><button class="btn primary" id="adSS" style="margin-top:14px">حفظ</button></div>
    <div class="card"><h3>${ic('info')}الحقوق وصفحة حول المنصة</h3><label class="f" style="margin-bottom:12px"><span>اسم المطور</span><input id="adD" value="${esc(c.devName)}"></label><label class="f" style="margin-bottom:12px"><span>نص الحقوق في أسفل المنصة</span><input id="adR" value="${esc(c.copyright)}"></label><label class="f"><span>نبذة «حول المنصة»</span><textarea id="adAb" rows="3">${esc(c.about)}</textarea></label><button class="btn primary" id="adRS" style="margin-top:14px">حفظ</button></div>
    <div class="card"><h3>${ic('spark')}التعبئة بالذكاء الاصطناعي</h3><p class="small muted" style="margin-top:0">فعّليها فقط بعد نشر الدالة الخادمية fill-schedule ووضع مفتاح Claude API في Supabase (راجعي دليل النشر). التكلفة على حسابك في Claude API.</p><label class="row"><input type="checkbox" id="adAI" ${c.aiFill ? 'checked' : ''}> إتاحة خيار الذكاء الاصطناعي للمعلمات</label><label class="f" style="margin-top:12px"><span>الحد اليومي لكل معلمة (عدد الصور)</span><input type="number" id="adAIL" min="1" max="50" value="${esc(c.aiDailyLimit || 5)}"></label><button class="btn primary" id="adAIS" style="margin-top:14px">حفظ</button></div>
    <div class="card"><h3>${ic('list')}إدارة الإصدارات</h3><p class="small muted" style="margin-top:0">الإصدار الحالي: <b>${esc(c.version)}</b></p><label class="f" style="margin-bottom:12px"><span>رقم الإصدار الجديد</span><input id="adV" dir="ltr" placeholder="1.1.0"></label><label class="f"><span>ملاحظات الإصدار</span><textarea id="adVN" rows="3"></textarea></label><button class="btn primary" id="adVS" style="margin-top:14px">نشر الإصدار</button>${(c.releases || []).length ? `<div class="small" style="margin-top:14px">${c.releases.slice().reverse().map(r => `<div><b>${esc(r.v)}</b> · ${esc(r.date)}</div>`).join('')}</div>` : ''}</div>
  </div>`;
  const saved = () => App.toast('تم حفظ الإعدادات');
  $('#adRep', el).onclick = () => principalReport(rows);
  const rf = $('#adRef', el); if (rf) rf.onclick = () => { App.registry = null; App.render(); };
  $('#adTh', el).onclick = e => { const b = e.target.closest('[data-t]'); if (b) b.classList.toggle('on'); };
  $('#adTS', el).onclick = async () => { const th = $$('#adTh .on', el).map(b => b.dataset.t); if (!th.length) { App.toast('اختاري ثيمًا واحدًا على الأقل', true); return; } let def = $('#adT', el).value; if (!th.includes(def)) def = th[0]; await App.saveConfig({themes: th, defaultTheme: def, allowCustom: $('#adC', el).checked}); saved(); };
  $('#adSS', el).onclick = async () => { await App.saveConfig({announce: App.val(el, '#adA'), maintenance: App.val(el, '#adM')}); saved(); };
  $('#adRS', el).onclick = async () => { await App.saveConfig({devName: App.val(el, '#adD'), copyright: App.val(el, '#adR'), about: App.val(el, '#adAb')}); saved(); };
  $('#adAIS', el).onclick = async () => { await App.saveConfig({aiFill: $('#adAI', el).checked, aiDailyLimit: Math.max(1, Math.min(50, +$('#adAIL', el).value || 5))}); saved(); };
  $('#adVS', el).onclick = async () => { const v = App.val(el, '#adV'); if (!v) { App.toast('اكتبي رقم الإصدار', true); return; } await App.saveConfig({version: v, releases: (c.releases || []).concat({v, date: D.ymd(new Date()), notes: App.val(el, '#adVN')})}); saved(); };
}});

function principalReport(rows) {
  const now = new Date(); const fd = t => t ? D.short(new Date(t)) : '—';
  const active7 = rows.filter(r => Date.now() - (r.lastActive || 0) < 7 * 86400000).length;
  const sum = k => rows.reduce((a, r) => a + ((r.counts || {})[k] || 0), 0);
  const body = rows.slice().sort((a, b) => (b.lastActive || 0) - (a.lastActive || 0)).map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.name || '—')}</td><td>${esc(r.school || '')}</td><td>${fd(r.joined)}</td><td>${fd(r.lastActive)}</td><td>${(r.counts || {}).tasks || 0}</td><td>${(r.counts || {}).plans || 0}</td><td>${(r.counts || {}).schedules || 0}</td><td>${(r.counts || {}).files || 0}</td><td>${(r.counts || {}).notes || 0}</td></tr>`).join('');
  const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير استخدام منصة منظّم المعلم</title><style>body{font-family:"IBM Plex Sans Arabic",Tahoma,Arial,sans-serif;margin:30px;color:#111}h1{margin:0;font-size:24px;color:#2f5bea}p{color:#555;margin:4px 0 18px}.k{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px}.k div{border:1px solid #dde;border-radius:10px;padding:12px 18px;min-width:140px}.k b{display:block;font-size:26px}table{border-collapse:collapse;width:100%;font-size:13px}th,td{border:1px solid #ccd;padding:7px;text-align:center}th{background:#eef1f8}td:nth-child(2){text-align:right;font-weight:600}button{padding:8px 16px;font:inherit;margin-bottom:14px}@media print{button{display:none}}</style></head><body><button onclick="print()">طباعة / حفظ PDF</button><h1>تقرير استخدام منصة «منظّم المعلم»</h1><p>تاريخ التقرير: ${esc(D.long(now))}${S.config.devName ? ' · إعداد: ' + esc(S.config.devName) : ''}</p><div class="k"><div><b>${rows.length}</b>معلمة مسجّلة</div><div><b>${active7}</b>نشطة خلال آخر 7 أيام</div><div><b>${sum('tasks')}</b>مهمة</div><div><b>${sum('plans')}</b>خطة</div><div><b>${sum('schedules')}</b>جدول</div><div><b>${sum('files')}</b>ملف</div></div><table><thead><tr><th>م</th><th>الاسم</th><th>المدرسة</th><th>أول دخول</th><th>آخر نشاط</th><th>المهام</th><th>الخطط</th><th>الجداول</th><th>الملفات</th><th>الملاحظات</th></tr></thead><tbody>${body || '<tr><td colspan="10">لا يوجد مستخدمات بعد</td></tr>'}</tbody></table></body></html>`;
  App.save('تقرير-المنصة-' + D.ymd(now) + '.html', html);
}

/* ================= Global search ================= */
App.globalSearch = () => App.modal({title:'بحث شامل', wide:true, foot:false, body:`<div class="search" style="margin-bottom:14px">${ic('search')}<input id="gq" placeholder="ابحثي في المهام والخطط والملاحظات والروابط والملفات والمواعيد"></div><div id="gr" class="items"></div>`, onMount(m, api) {
  const q = $('#gq', m); setTimeout(() => q.focus(), 40);
  q.oninput = () => { const s = q.value.trim(); const out = [];
    if (s.length >= 2) {
      S.tasks.forEach(t => (t.title + ' ' + (t.desc || '')).includes(s) && out.push(['task', t.id, t.title, 'مهمة', 'check']));
      S.plans.forEach(p => p.name.includes(s) && out.push(['plan', p.id, p.name, 'خطة', 'target']));
      S.notes.forEach(n => ((n.title || '') + ' ' + n.body).includes(s) && out.push(['note', n.id, n.title || n.body.slice(0, 60), 'ملاحظة', 'note']));
      S.links.forEach(l => (l.title + ' ' + (l.desc || '')).includes(s) && out.push(['link', l.id, l.title, 'رابط', 'link']));
      S.files.forEach(f => f.name.includes(s) && out.push(['file', f.id, f.name, 'ملف', 'file']));
      S.events.forEach(e => e.title.includes(s) && out.push(['event', e.id, e.title, 'موعد', 'cal']));
    }
    $('#gr', m).innerHTML = s.length < 2 ? '<p class="muted small">اكتبي حرفين على الأقل.</p>' : out.length ? out.slice(0, 40).map(r => `<button class="item" style="text-align:start;cursor:pointer" data-r="${r[0]}:${r[1]}">${ic(r[4])}<span class="body t">${esc(r[2])}</span><span class="badge">${r[3]}</span></button>`).join('') : '<p class="muted small">لا نتائج.</p>';
    $$('[data-r]', m).forEach(b => b.onclick = () => { const [k, id] = b.dataset.r.split(':'); api.close();
      ({task: () => App.showTask(id), plan: () => App.showPlan(id), note: () => App.editNote(S.notes.find(x => x.id === id)), link: () => App.editLink(S.links.find(x => x.id === id)), file: () => App.previewFile(S.files.find(x => x.id === id)), event: () => App.editEvent(S.events.find(x => x.id === id))})[k](); });
  };
  q.oninput();
}});
})();
