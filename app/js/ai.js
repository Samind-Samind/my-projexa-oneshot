// js/ai.js — ตัวช่วยเรียก OpenRouter + บันทึก aiLog (ใช้ร่วม SCR-010 / SCR-013)
// ผลของ AI เป็นเพียง "ข้อเสนอ" — ผู้ใช้ต้องกดยืนยันก่อนจึงนำไปใช้
import { db } from "./firebase-config.js";
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { nowIso, esc } from "./common.js";

// openrouter-config.js ถูก gitignore และไม่ถูก deploy → ไม่พบ = ฟีเจอร์ใช้ไม่ได้ (คืน null)
export async function loadAiConfig() {
  try {
    const mod = await import("./openrouter-config.js");
    const cfg = mod.OPENROUTER_CONFIG;
    if (!cfg || !cfg.apiKey || cfg.apiKey.startsWith("YOUR_")) return null;
    return cfg;
  } catch (e) {
    return null;
  }
}

function parseJsonReply(text) {
  let t = String(text || "").trim();
  t = t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try { return JSON.parse(t); } catch (e) { /* ลองดึงก้อน {...} */ }
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1));
  throw new Error("ไม่สามารถอ่านผลลัพธ์ JSON จาก AI ได้");
}

// messages: [{role, content}] → { raw, parsed }
export async function callOpenRouter(messages) {
  const cfg = await loadAiConfig();
  if (!cfg) throw new Error("AI_UNAVAILABLE");
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({
      model: cfg.model,
      messages,
      temperature: 0.2,
      response_format: { type: "json_object" }
    })
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`OpenRouter ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content ?? "";
  return { raw, parsed: parseJsonReply(raw) };
}

// บันทึก log ทั้งสำเร็จ/ล้มเหลว; หน้าจอใหม่ที่ยังไม่มี id → ข้าม
export async function logAi(screenId, { source, input, output = null, error = null }, me) {
  if (!screenId) return;
  try {
    await addDoc(collection(db, "screens", screenId, "aiLog"), {
      source,
      input: typeof input === "string" ? input : JSON.stringify(input),
      output: output ?? null,
      error: error ? String(error) : null,
      created_by: me.user_id,
      created_by_name: me.name,
      createdAt: nowIso()
    });
  } catch (e) {
    console.warn("บันทึก aiLog ไม่สำเร็จ", e);
  }
}

export const confClass = (c) => (c >= 0.8 ? "conf-high" : c >= 0.5 ? "conf-mid" : "conf-low");
export const confText = (c) => (typeof c === "number" ? `${Math.round(c * 100)}%` : "-");

// HTML กล่องข้อเสนอ AI (ปุ่มใช้ data-act="ai-confirm" / "ai-cancel")
export function aiProposalHtml({ title, bodyHtml, confidence, reason }) {
  return `<div class="ai-box">
    <div class="ai-box-head"><span class="ai-badge">AI ข้อเสนอ</span><strong>${esc(title)}</strong>
      <span class="confidence ${confClass(confidence)}">ความมั่นใจ ${confText(confidence)}</span></div>
    <div class="ai-box-body">${bodyHtml}<div class="ai-reason">เหตุผล: ${esc(reason || "-")}</div></div>
    <div class="ai-box-actions">
      <button type="button" class="btn btn-primary btn-sm" data-act="ai-confirm">ยืนยัน</button>
      <button type="button" class="btn btn-secondary btn-sm" data-act="ai-cancel">ยกเลิก</button>
    </div></div>`;
}
