/* تعبئة الجدول من صورة: قراءة مجانية (Tesseract) أو بالذكاء الاصطناعي (Claude عبر دالة خادمية) */
'use strict';
(function(){
const {$, $$, esc, ic, D, S, Store} = App;
const FILL = App.Fill = {};

/* ---------- helpers ---------- */
const loadScript = src => new Promise((res, rej) => { if (document.querySelector(`script[src="${src}"]`)) return res(); const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('تعذّر تحميل أداة القراءة. تحققي من الإنترنت.')); document.head.appendChild(s); });
const AR_DIGITS = {'٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9','۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9'};
const norm = t => String(t || '').replace(/[٠-٩۰-۹]/g, d => AR_DIGITS[d]).replace(/[ً-ْـ]/g, '').replace(/[إأآ]/g, 'ا').replace(/ى/g, 'ي').trim();
const DAYKEYS = [['احد',0],['اثنين',1],['اثنن',1],['ثلاث',2],['اربع',3],['خميس',4],['جمع',5],['سبت',6]];
FILL.dayIndex = t => { const n = norm(t).replace(/ة/g, 'ه'); for (const [k, i] of DAYKEYS) if (n.includes(k)) return i; return -1; };
const light = t => String(t || '').replace(/[٠-٩۰-۹]/g, d => AR_DIGITS[d]).replace(/[\u064B-\u0652\u0640]/g, '').trim();
const toHM = (h, m) => `${App.pad(h % 24)}:${App.pad(m)}`;
const fix24 = h => (h >= 1 && h <= 5 ? h + 12 : h);   // school day: 1–5 o'clock means afternoon
const SEC_RE = /(\d{1,2})\s*[\/\-\\]\s*([ء-ي])|([ء-ي])\s*[\/\-\\]\s*(\d{1,2})/;
const GRADE_RE = /(الصف|الاول|الثاني|الثالث|الرابع|الخامس|السادس|ابتدائي|متوسط|ثانوي)/;
FILL.splitCell = text => {
  let t = light(text).replace(/[|_+•·]+/g, ' ').replace(/\s+/g, ' ').trim();
  let section = '', grade = '';
  const m = t.match(SEC_RE);
  if (m) { section = m[1] ? `${m[1]}/${m[2]}` : `${m[4]}/${m[3]}`; t = t.replace(m[0], ' ').trim(); }
  const words = t.split(' ').filter(Boolean); const gw = [], sw = [];
  words.forEach(w => (GRADE_RE.test(norm(w)) && !/لغتي|لغه/.test(w) ? gw : sw).push(w));
  grade = gw.join(' ');
  return {subject: sw.join(' ').trim(), grade, section};
};

/* ---------- image preparation ---------- */
FILL.pdfToCanvas = blob => App.pdfToCanvas(blob, 2200);
FILL.toCanvas = async (blob, maxSide) => {
  let src;
  if ((blob.type || '').includes('pdf')) src = await FILL.pdfToCanvas(blob);
  else src = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('تعذّرت قراءة الصورة. جرّبي صورة PNG أو JPG.')); im.src = URL.createObjectURL(blob); });
  const w = src.naturalWidth || src.width, h = src.naturalHeight || src.height; const s = Math.min(1, maxSide / Math.max(w, h)) || 1;
  const c = document.createElement('canvas'); c.width = Math.round(w * s); c.height = Math.round(h * s);
  const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(src, 0, 0, c.width, c.height); return c;
};

/* ---------- layout parser: words with boxes -> timetable ---------- */
FILL.parseWords = (words, W) => {
  const ws = words.map(w => ({t: norm(w.text), raw: light(w.text), x0: w.bbox.x0, x1: w.bbox.x1, y0: w.bbox.y0, y1: w.bbox.y1})).filter(w => w.t && !/^[|_\-–—.,:؛،+•·()]+$/.test(w.t))
    .map(w => Object.assign(w, {cx: (w.x0 + w.x1) / 2, cy: (w.y0 + w.y1) / 2, h: w.y1 - w.y0}));
  // 1) day labels: one column of day names
  let days = ws.filter(w => FILL.dayIndex(w.t) >= 0).map(w => Object.assign(w, {d: FILL.dayIndex(w.t)}));
  if (days.length < 2) throw new Error('لم أتعرّف على أسماء الأيام في الصورة. جرّبي صورة أوضح أو مقصوصة على الجدول فقط.');
  const medX = days.map(d => d.cx).sort((a, b) => a - b)[Math.floor(days.length / 2)];
  days = days.filter(d => Math.abs(d.cx - medX) < W * 0.12).sort((a, b) => a.cy - b.cy);
  const seen = new Set(); days = days.filter(d => !seen.has(d.d) && seen.add(d.d));
  const dayBand = [Math.min(...days.map(d => d.x0)) - 4, Math.max(...days.map(d => d.x1)) + 4];
  const gaps = days.slice(1).map((d, i) => d.cy - days[i].cy); const gap = gaps.length ? gaps.sort((a, b) => a - b)[Math.floor(gaps.length / 2)] : 60;
  const rows = days.map((d, i) => ({d: d.d, top: i ? (days[i - 1].cy + d.cy) / 2 : d.cy - gap / 2, bot: i < days.length - 1 ? (d.cy + days[i + 1].cy) / 2 : d.cy + gap / 2}));
  const headerBot = rows[0].top;
  const inDayBand = w => w.cx >= dayBand[0] && w.cx <= dayBand[1];
  // 2) period columns from header numbers ("الحصة 1")
  const header = ws.filter(w => w.cy < headerBot && w.cy > headerBot - gap * 2.2 && !inDayBand(w));
  let cols = [];
  header.forEach(w => { const m = w.t.match(/^(?:الحصه|الحصة|حصه|حصة)?\s*(\d{1,2})$/); if (m && !/:/.test(w.t)) { const n = +m[1]; if (n >= 1 && n <= 12) cols.push({n, cx: w.cx, cy: w.cy}); } });
  const byN = {}; cols.forEach(c => { if (!byN[c.n] || c.cy < byN[c.n].cy) byN[c.n] = c; }); cols = Object.values(byN).sort((a, b) => b.cx - a.cx);
  const body = ws.filter(w => w.cy >= rows[0].top && w.cy <= rows[rows.length - 1].bot && !inDayBand(w) && FILL.dayIndex(w.t) < 0);
  if (cols.length < 2) {
    // fallback: cluster body words into columns by x (right to left)
    const xs = body.map(w => w.cx).sort((a, b) => b - a); const groups = [];
    xs.forEach(x => { const g = groups[groups.length - 1]; if (g && g.last - x < W * 0.035) { g.xs.push(x); g.last = x; } else groups.push({xs: [x], last: x}); });
    cols = groups.map((g, i) => ({n: i + 1, cx: g.xs.reduce((a, b) => a + b, 0) / g.xs.length}));
  }
  if (!cols.length) throw new Error('لم أتعرّف على أعمدة الحصص في الصورة.');
  const colSpan = cols.length > 1 ? Math.abs(cols[0].cx - cols[cols.length - 1].cx) / (cols.length - 1) : W / 4;
  const nearestCol = x => { let best = null, bd = Infinity; cols.forEach(c => { const d = Math.abs(c.cx - x); if (d < bd) { bd = d; best = c; } }); return bd < colSpan * 0.75 ? best : null; };
  // 3) times per column
  const periods = {};
  const tokens = header.map(w => ({w, m: w.t.match(/(\d{1,2})[:.٫](\d{2})/)})).filter(x => x.m);
  cols.forEach(c => {
    const ts = tokens.filter(x => nearestCol(x.w.cx) === c).sort((a, b) => b.w.cx - a.w.cx || a.w.cy - b.w.cy);
    if (ts.length >= 2) { let s = fix24(+ts[0].m[1]), e = fix24(+ts[1].m[1]); const sm = +ts[0].m[2], em = +ts[1].m[2]; if (e * 60 + em < s * 60 + sm) [s, e] = [e, s]; periods[c.n] = {start: toHM(s, sm), end: toHM(e, em)}; }
  });
  // 4) cells
  const cellWords = {};
  body.forEach(w => { const r = rows.find(r => w.cy >= r.top && w.cy < r.bot); const c = nearestCol(w.cx); if (!r || !c) return; (cellWords[r.d + '-' + c.n] = cellWords[r.d + '-' + c.n] || []).push(w); });
  const cells = [];
  Object.entries(cellWords).forEach(([k, arr]) => {
    const [d, n] = k.split('-').map(Number);
    arr.sort((a, b) => (Math.abs(a.cy - b.cy) > a.h * 0.6 ? a.cy - b.cy : b.cx - a.cx));
    const v = FILL.splitCell(arr.map(w => w.raw).join(' '));
    if (v.subject || v.section) cells.push(Object.assign({day: d, period: n}, v));
  });
  const maxN = Math.max(...cols.map(c => c.n));
  const plist = []; for (let i = 1; i <= maxN; i++) plist.push(periods[i] || null);
  return {periods: plist.every(Boolean) ? plist : [], periodCount: maxN, days: rows.map(r => r.d), cells};
};

/* ---------- readers ---------- */
FILL.ocr = async (canvas, onProg) => {
  await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');
  onProg('تجهيز أداة القراءة (أول مرة قد تستغرق دقيقة)…');
  const worker = await window.Tesseract.createWorker('ara+eng', 1, {logger: m => { if (m.status === 'recognizing text') onProg(`جارٍ قراءة الصورة ${Math.round(m.progress * 100)}%`); }});
  try {
    await worker.setParameters({preserve_interword_spaces: '1'});
    const {data} = await worker.recognize(canvas);
    return FILL.parseWords(data.words || [], canvas.width);
  } finally { worker.terminate(); }
};
FILL.ai = async (canvas, onProg) => {
  if (Store.mode !== 'cloud') throw new Error('القراءة بالذكاء الاصطناعي تعمل بعد ربط المنصة بقاعدة البيانات.');
  onProg('يقرأ Claude الجدول… قد يستغرق 20–40 ثانية');
  const b64 = canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
  const {data, error} = await Store.sb.functions.invoke('fill-schedule', {body: {image: b64, mediaType: 'image/jpeg'}});
  if (error) {
    let msg = ''; try { msg = (await error.context.json()).error; } catch(e) {}
    throw new Error(msg || 'تعذّر الاتصال بخدمة القراءة. تأكدي أن المطور فعّل الخدمة.');
  }
  if (!data || data.error) throw new Error((data && data.error) || 'لم تصل نتيجة.');
  const r = data.result || {};
  const cells = (r.cells || []).map(c => Object.assign({day: typeof c.day === 'number' ? c.day : FILL.dayIndex(c.day), period: +c.period}, {subject: String(c.subject || '').trim(), grade: String(c.grade || '').trim(), section: String(c.section || '').trim(), note: String(c.note || '').trim()})).filter(c => c.day >= 0 && c.period >= 1 && c.period <= 15 && (c.subject || c.section));
  const periods = (r.periods || []).filter(p => /^\d{1,2}:\d{2}$/.test(p.start || '') && /^\d{1,2}:\d{2}$/.test(p.end || '')).map(p => ({start: p.start.padStart(5, '0'), end: p.end.padStart(5, '0')}));
  const maxN = Math.max(periods.length, ...cells.map(c => c.period), 0);
  if (data.remaining != null) App.toast(`المتبقي لك اليوم: ${data.remaining} صور`);
  return {periods, periodCount: maxN, days: [...new Set(cells.map(c => c.day))], cells};
};

/* ---------- UI ---------- */
FILL.available = () => { const m = (S.profile || {}).fillMethod; if (m === 'ocr') return 'ocr'; if (m === 'ai' && S.config.aiFill) return 'ai'; return null; };
FILL.label = m => m === 'ai' ? 'تعبئة بالذكاء الاصطناعي' : 'تعبئة تلقائية من صورة';
FILL.open = sc => {
  const method = FILL.available(); if (!method) return;
  const imgs = (sc.att || []).map(id => S.files.find(f => f.id === id)).filter(f => f && (f.kind === 'img' || f.kind === 'pdf'));
  let picked = imgs[0] ? {file: imgs[0]} : null; let result = null;
  App.modal({title: FILL.label(method), wide: true, body: `
    <p class="muted" style="margin-top:0">${method === 'ai' ? 'يقرأ Claude صورة جدولك ويعبّئ الحصص والأوقات.' : 'تُقرأ الصورة على جهازك مجانًا.'} ستظهر لك النتيجة لتراجعيها قبل الحفظ.</p>
    <div class="section"><h4>اختاري صورة الجدول</h4><div class="items" id="fpick">${imgs.map((f, i) => `<label class="item" style="cursor:pointer"><input type="radio" name="fp" value="${f.id}" ${i === 0 ? 'checked' : ''} style="width:20px;height:20px;min-height:0;accent-color:var(--accent)"><span class="ficon ${f.kind}" style="width:32px;height:32px;font-size:9px">${f.kind.toUpperCase()}</span><span class="body t">${esc(f.name)}</span></label>`).join('')}<label class="item" style="cursor:pointer"><input type="radio" name="fp" value="__new" ${imgs.length ? '' : 'checked'} style="width:20px;height:20px;min-height:0;accent-color:var(--accent)"><span class="body"><span class="t">صورة أو PDF من جهازك</span><span class="small muted" id="fnew" style="display:block">لم تُختر بعد</span></span><button type="button" class="btn sm" id="fbrowse">${ic('upload')}اختيار</button></label></div><input type="file" accept="image/*,application/pdf" hidden id="ffile"></div>
    <div class="row wrap"><button type="button" class="btn primary" id="frun">${ic('spark')}قراءة الجدول</button><span class="small muted" id="fprog"></span></div>
    <p class="small muted">${method === 'ocr' ? 'للحصول على أفضل نتيجة: صورة مستقيمة وواضحة ومقصوصة على الجدول، فيها أسماء الأيام وأرقام الحصص.' : 'تُرسل الصورة لخدمة Claude لقراءتها فقط ولا تُحفظ هناك.'}</p>
    <div id="fres"></div>`,
  onMount(m, api) {
    const fi = $('#ffile', m);
    $('#fbrowse', m).onclick = e => { e.preventDefault(); fi.click(); };
    fi.onchange = () => { const f = fi.files[0]; if (!f) return; picked = {blob: f}; $('#fnew', m).textContent = f.name; $('input[value=__new]', m).checked = true; };
    $$('input[name=fp]', m).forEach(r => r.onchange = () => { picked = r.value === '__new' ? (fi.files[0] ? {blob: fi.files[0]} : null) : {file: S.files.find(f => f.id === r.value)}; });
    $('#frun', m).onclick = async () => {
      if (!picked) { App.toast('اختاري صورة الجدول أولًا', true); return; }
      const btn = $('#frun', m), prog = $('#fprog', m); btn.disabled = true; $('#fres', m).innerHTML = '';
      try {
        prog.textContent = 'تجهيز الصورة…';
        const blob = picked.blob || await App.fileBlob(picked.file);
        const canvas = await FILL.toCanvas(blob, method === 'ai' ? 1568 : 2400);
        result = await (method === 'ai' ? FILL.ai : FILL.ocr)(canvas, t => prog.textContent = t);
        if (!result.cells.length) throw new Error('لم أجد حصصًا في الصورة. جرّبي صورة أوضح.');
        prog.textContent = `وجدتُ ${result.cells.length} حصة. راجعيها ثم اضغطي «تطبيق على الجدول».`;
        $('#fres', m).innerHTML = preview(sc, result);
        $('.mf', api.el).hidden = false;
      } catch(e) { prog.textContent = ''; $('#fres', m).innerHTML = `<div class="card small" style="border-color:var(--danger);color:var(--danger)">${esc(e.message || 'تعذّرت القراءة')}</div>`; }
      finally { btn.disabled = false; }
    };
    $('.mf', api.el).hidden = true;
  },
  foot: [{label: 'تطبيق على الجدول', cls: 'primary', icon: 'check', async onClick(api) {
    if (!result) return false;
    const m = api.el; const cur = S.schedules.find(x => x.id === sc.id) || sc;
    const useTimes = $('#fTimes', m) && $('#fTimes', m).checked && result.periods.length;
    let periods = useTimes ? result.periods.slice() : (cur.periods || []).slice();
    while (periods.length < result.periodCount) { const last = periods[periods.length - 1] || {end: '07:00'}; const s = D.mins(last.end); periods.push({start: last.end, end: toHM(Math.floor((s + 45) / 60), (s + 45) % 60)}); }
    const cells = $('#fRepl', m) && $('#fRepl', m).checked ? {} : Object.assign({}, cur.cells || {});
    result.cells.forEach(c => { cells[c.day + '-' + (c.period - 1)] = {subject: c.subject, grade: c.grade || '', section: c.section || '', note: c.note || ''}; });
    const days = [...new Set((cur.days || []).concat(result.days))].sort((a, b) => a - b);
    await Store.put('schedules', Object.assign({}, cur, {periods, cells, days}));
    App.toast('تمت تعبئة الجدول. اضغطي أي خانة لتعديلها');
  }}]});
};
function preview(sc, r) {
  const days = [...new Set(r.days.concat(r.cells.map(c => c.day)))].sort((a, b) => a - b);
  const n = r.periodCount; const get = (d, p) => r.cells.find(c => c.day === d && c.period === p);
  const hasOld = Object.keys(sc.cells || {}).length;
  return `<div class="section" style="margin-top:14px"><h4>النتيجة</h4><div class="tt-wrap"><table class="tt" style="min-width:${Math.max(520, n * 96 + 90)}px"><thead><tr><th>اليوم</th>${Array.from({length: n}, (_, i) => `<th>الحصة ${i + 1}${r.periods[i] ? `<small>${D.time12(r.periods[i].start)} – ${D.time12(r.periods[i].end)}</small>` : ''}</th>`).join('')}</tr></thead><tbody>${days.map(d => `<tr><th>${D.DAYS[d]}</th>${Array.from({length: n}, (_, i) => { const c = get(d, i + 1); return `<td style="cursor:default">${c ? `<b>${esc(c.subject)}</b><small>${esc([c.grade, c.section].filter(Boolean).join(' · '))}</small>` : ''}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>
  <div class="row wrap" style="margin-top:12px;gap:18px">${r.periods.length ? `<label class="row"><input type="checkbox" id="fTimes" checked> تحديث أوقات الحصص من الصورة</label>` : '<span class="small muted">لم تُقرأ أوقات الحصص؛ ستبقى الأوقات الحالية.</span>'}${hasOld ? `<label class="row"><input type="checkbox" id="fRepl" checked> استبدال الحصص الحالية</label>` : ''}</div></div>`;
}
})();
