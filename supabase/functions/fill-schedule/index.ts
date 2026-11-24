// منظّم المعلم — دالة قراءة صورة الجدول بالذكاء الاصطناعي (Gemini)
// تُنشر في Supabase باسم: fill-schedule
// تحتاج سرًّا واحدًا: GEMINI_API_KEY  (واختياريًا GEMINI_MODEL)
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const PROMPT = `This image is a weekly school timetable from a Saudi school, written in Arabic (right-to-left).
Read it carefully and reply with ONLY one JSON object, no other text, in exactly this shape:
{"periods":[{"start":"07:00","end":"07:45"}],"cells":[{"day":"الأحد","period":1,"subject":"لغتي","grade":"الثالث الابتدائي","section":"3/أ","note":""}]}
Rules:
- "periods": one entry per period column in order (period 1 first), times in 24-hour HH:MM. "ص" means AM and "م" means PM; school times like 1:00 are afternoon (13:00). If times are not shown, use [].
- "cells": one entry per NON-EMPTY cell only. "day" must be exactly one of: الأحد، الاثنين، الثلاثاء، الأربعاء، الخميس، الجمعة، السبت. "period" is the 1-based period number.
- "subject": the subject or activity written in the cell. "section": the class/section such as 3/أ or ٣/ب written with western digits (3/أ). "grade": the grade if written (e.g. الثالث الابتدائي), else "". "note": any extra text, else "".
- Copy Arabic text exactly as written. Do not invent cells.
- If the image is not a timetable, reply {"error":"not_timetable"}.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "طريقة غير مسموحة" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const key = Deno.env.get("GEMINI_API_KEY");
    if (!key) return json({ error: "خدمة القراءة غير مهيأة بعد (مفتاح Gemini غير موجود)." }, 500);

    // who is calling?
    const userClient = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "سجّلي الدخول أولًا." }, 401);

    const admin = createClient(url, service);
    const { data: cfgRow } = await admin.from("config").select("data").eq("id", 1).maybeSingle();
    const cfg = (cfgRow?.data ?? {}) as Record<string, unknown>;
    if (!cfg.aiFill) return json({ error: "ميزة الذكاء الاصطناعي غير مفعّلة من المطور." }, 403);
    const limit = Math.max(1, Math.min(50, Number(cfg.aiDailyLimit) || 5));

    const today = new Date().toISOString().slice(0, 10);
    const { data: usage } = await admin.from("ai_usage").select("count").eq("user_id", user.id).eq("day", today).maybeSingle();
    const used = usage?.count ?? 0;
    if (used >= limit) return json({ error: `وصلتِ إلى الحد اليومي (${limit} صور). جرّبي غدًا.` }, 429);

    const body = await req.json().catch(() => ({}));
    const image = String(body.image ?? "");
    const mediaType = String(body.mediaType ?? "image/jpeg");
    if (!image || image.length > 7_000_000) return json({ error: "الصورة غير صالحة أو كبيرة جدًا." }, 400);
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mediaType)) return json({ error: "نوع الصورة غير مدعوم." }, 400);

    const models = [...new Set([Deno.env.get("GEMINI_MODEL"), "gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.7-flash", "gemini-3.8-flash", "gemini-flash-latest", "gemini-flash-lite-latest"].filter(Boolean))] as string[];
    const mk = (fast: boolean) => JSON.stringify({
      contents: [{ role: "user", parts: [
        { inline_data: { mime_type: mediaType, data: image } },
        { text: PROMPT },
      ] }],
      generationConfig: { responseMimeType: "application/json", maxOutputTokens: 8192, ...(fast ? { thinkingConfig: { thinkingLevel: "low" } } : {}) },
    });
    let fast = true;
    let r: Response | null = null; let lastStatus = 0; let lastText = ""; let busy = false;
    const deadline = Date.now() + 120_000;
    outer: for (const model of models) {
      for (let attempt = 0; attempt < 2; attempt++) {
        if (Date.now() > deadline) break outer;
        try {
          r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
            method: "POST", headers: { "x-goog-api-key": key, "content-type": "application/json" }, body: mk(fast),
            signal: AbortSignal.timeout(Math.max(5_000, Math.min(70_000, deadline - Date.now()))),
          });
        } catch (_e) { console.error("gemini", model, "timeout"); busy = true; r = null; continue outer; }
        if (r.ok) { console.log("gemini ok", model, fast ? "fast" : ""); break outer; }
        lastStatus = r.status; lastText = await r.text(); if (r.status === 429 || r.status === 503) busy = true; console.error("gemini", model, r.status, lastText.slice(0, 300));
        if (r.status === 400 && /API key/i.test(lastText)) return json({ error: "مفتاح Gemini غير صحيح. راجعي المفتاح في إعدادات Supabase." }, 502);
        if (r.status === 400 && fast && /thinking/i.test(lastText)) { fast = false; continue; }
        if (r.status === 404 || r.status === 400) continue outer;
        continue outer;
      }
    }
    if (!r || !r.ok) return json({ error: busy ? "خدمة القراءة مشغولة الآن، أعيدي المحاولة بعد قليل." : "تعذّر الاتصال بخدمة القراءة." }, 502);
    const out = await r.json();
    const parts = out.candidates?.[0]?.content?.parts ?? [];
    const text: string = parts.filter((p: { text?: string; thought?: boolean }) => p.text && !p.thought).map((p: { text: string }) => p.text).join("");
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return json({ error: "لم أستطع قراءة الجدول من الصورة." }, 422);
    const result = JSON.parse(m[0]);
    if (result.error) return json({ error: "الصورة لا تبدو جدولًا دراسيًا." }, 422);

    await admin.from("ai_usage").upsert({ user_id: user.id, day: today, count: used + 1 });
    return json({ result, remaining: limit - used - 1 });
  } catch (e) {
    console.error(e);
    return json({ error: "حدث خطأ غير متوقع أثناء القراءة." }, 500);
  }
});
