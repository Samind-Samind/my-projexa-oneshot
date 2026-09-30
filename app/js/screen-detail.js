// js/screen-detail.js — SCR-010 รายละเอียดหน้าจอ (สร้าง/แก้ไข/ลบ + AI แนะนำประเภท)
import { db } from "./firebase-config.js";
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, query, where
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { requireAuth, renderShell, showToast, openModal, esc, nowIso, formatDateTime, statusPill } from "./common.js";
import { PAGE, canManageRegistry, denyAccessAndRedirect } from "./acl.js";
import { loadAiConfig, callOpenRouter, logAi, aiProposalHtml, confText } from "./ai.js";

const me = await requireAuth();
renderShell(PAGE.SCR010);
if (!canManageRegistry(me.role)) { denyAccessAndRedirect(); throw new Error("no access"); }

const $ = (id) => document.getElementById(id);
const screenId = new URLSearchParams(location.search).get("id");
const isEdit = !!screenId;

let loaded = null;        // เอกสารที่โหลดมา (edit)
let types = [];           // [{code,label}]
let origin = "ManualEntry";
let aiConfidence = null;
let isSuggested = false;
let aiConfirmedType = null;   // type_id ที่ผู้ใช้ยืนยันจาก AI ใน session นี้
let pendingAiSuggestion = null; // {summary, source, confidence, createdAt}
let proposal = null;
let saving = false;

function setError(fieldId, msg) {
  const f = $(fieldId);
  f.classList.toggle("has-error", !!msg);
  f.querySelector(".field-error").textContent = msg || "";
}

async function loadTypes() {
  const snap = await getDocs(collection(db, "screenTypes"));
  types = snap.docs.map((d) => d.data()).filter((t) => t.is_active !== false)
    .sort((a, b) => String(a.code).localeCompare(String(b.code)));
  $("type").innerHTML = `<option value="">— เลือกประเภท —</option>` +
    types.map((t) => `<option value="${esc(t.code)}">${esc(t.label)}</option>`).join("");
}

function renderMeta() {
  if (!loaded) { $("meta-area").innerHTML = ""; return; }
  const rows = [
    ["สถานะปัจจุบัน", statusPill(loaded.current_status)],
    ["ผู้รับผิดชอบ", (loaded.assignees || []).length
      ? (loaded.assignees || []).map((a) => `<span class="assignee-chip">${esc(a.user_name)} <span class="assignee-role">${esc(a.role)}</span></span>`).join(" ")
      : '<span class="muted">ยังไม่มี</span>'],
    ["สร้างโดย", `${esc(loaded.created_by_name || "-")} · ${esc(formatDateTime(loaded.created_at))}`],
    ["แก้ไขล่าสุด", esc(formatDateTime(loaded.updated_at))]
  ];
  if (loaded.aiSuggestion) {
    rows.push(["AI แนะนำล่าสุด", `${esc(loaded.aiSuggestion.summary)} (${confText(loaded.aiSuggestion.confidence)})`]);
  }
  $("meta-area").innerHTML = rows.map(([k, v]) =>
    `<div class="kv"><div class="kv-label">${k}</div><div class="kv-value">${v}</div></div>`).join("");
}

function updateTypeHint() {
  const hint = $("type-hint");
  if (origin === "AIGenerated") hint.textContent = `ประเภทนี้มาจาก AI (ความมั่นใจ ${confText(aiConfidence)}) — จะถูกทำเครื่องหมายว่าผ่านการยืนยันโดยคนเมื่อบันทึก`;
  else if (origin === "HumanConfirmed") hint.textContent = `ประเภทนี้มาจาก AI และผู้ใช้ยืนยันแล้ว (ความมั่นใจ ${confText(aiConfidence)})`;
  else hint.textContent = "";
}

function fillForm(s) {
  $("code").value = s.code || "";
  $("name").value = s.name || "";
  $("description").value = s.description || "";
  $("type").value = s.type?.type_id || "";
  origin = s.origin_label || "ManualEntry";
  aiConfidence = s.ai_confidence ?? null;
  isSuggested = !!s.is_suggested;
  updateTypeHint();
  renderMeta();
}

async function init() {
  await loadTypes();
  if (isEdit) {
    const snap = await getDoc(doc(db, "screens", screenId));
    if (!snap.exists() || snap.data().is_deleted) {
      showToast("ไม่พบหน้าจอนี้ (อาจถูกลบไปแล้ว)", "danger");
      setTimeout(() => { location.href = "scr-009.html"; }, 1500);
      return;
    }
    loaded = { ...snap.data(), screens_id: snap.id };
    fillForm(loaded);
    $("page-title").textContent = "แก้ไขหน้าจอ";
    $("page-sub").textContent = `${loaded.code} — ${loaded.name}`;
    $("crumb").textContent = loaded.code;
    $("header-actions").innerHTML = `<button type="button" class="btn btn-danger" id="btn-delete">ลบหน้าจอ</button>`;
    $("btn-delete").addEventListener("click", onDelete);
  } else {
    $("page-title").textContent = "เพิ่มหน้าจอใหม่";
    $("page-sub").textContent = "กรอกข้อมูลหน้าจอ แล้วกดบันทึก";
    $("crumb").textContent = "เพิ่มหน้าจอใหม่";
  }
  $("loading").classList.add("hidden");
  $("screen-form").classList.remove("hidden");
}

// ── Validation ──
async function validate() {
  let ok = true;
  const code = $("code").value.trim();
  const name = $("name").value.trim();
  const typeCode = $("type").value;
  setError("f-code", ""); setError("f-name", ""); setError("f-type", "");
  if (!code) { setError("f-code", "กรุณากรอกรหัสหน้าจอ"); ok = false; }
  if (!name) { setError("f-name", "กรุณากรอกชื่อหน้าจอ"); ok = false; }
  if (!types.some((t) => t.code === typeCode)) { setError("f-type", "กรุณาเลือกประเภทหน้าจอ"); ok = false; }
  if (code) {
    const snap = await getDocs(query(collection(db, "screens"), where("code", "==", code)));
    const dup = snap.docs.some((d) => d.id !== screenId && !d.data().is_deleted);
    if (dup) { setError("f-code", "รหัสนี้ถูกใช้แล้ว"); ok = false; }
  }
  return ok;
}

// ── บันทึก ──
async function onSave(e) {
  e.preventDefault();
  if (saving) return;
  saving = true; $("btn-save").disabled = true;
  try {
    if (!(await validate())) return;
    const typeCode = $("type").value;
    const t = types.find((x) => x.code === typeCode);
    const type = t ? { type_id: t.code, label: t.label } : null;

    // origin ตอนบันทึก
    let fOrigin = origin, fConf = aiConfidence, fSuggested = isSuggested;
    if (aiConfirmedType && aiConfirmedType === typeCode) {
      fOrigin = "HumanConfirmed"; fSuggested = false;
    } else if (isEdit ? typeCode !== (loaded.type?.type_id || "") : !!typeCode) {
      // เลือกประเภทเอง
      if (!(aiConfirmedType && aiConfirmedType === typeCode)) { fOrigin = "ManualEntry"; fConf = null; fSuggested = false; }
    }

    const base = {
      code: $("code").value.trim(),
      name: $("name").value.trim(),
      description: $("description").value.trim(),
      type,
      origin_label: fOrigin,
      ai_confidence: fConf,
      is_suggested: fSuggested,
      updated_at: nowIso()
    };
    if (pendingAiSuggestion) base.aiSuggestion = pendingAiSuggestion;

    if (isEdit) {
      const ref = doc(db, "screens", screenId);
      const cur = await getDoc(ref);
      if (!cur.exists() || cur.data().is_deleted) {
        showToast("หน้าจอนี้ถูกลบไปแล้ว", "danger");
        setTimeout(() => { location.href = "scr-009.html"; }, 1500);
        return;
      }
      if (cur.data().updated_at !== loaded.updated_at) {
        await openModal({
          title: "ข้อมูลถูกแก้ไขโดยผู้อื่น",
          bodyHtml: `<p>มีผู้อื่นแก้ไขหน้าจอนี้ระหว่างที่คุณกำลังแก้ไข ระบบจะไม่เขียนทับ และจะโหลดข้อมูลล่าสุดมาแสดงใหม่</p>`,
          confirmText: "โหลดข้อมูลล่าสุด"
        });
        loaded = { ...cur.data(), screens_id: cur.id };
        aiConfirmedType = null; pendingAiSuggestion = null; proposal = null; $("ai-area").innerHTML = "";
        fillForm(loaded);
        return;
      }
      await updateDoc(ref, base);
      showToast("บันทึกการแก้ไขแล้ว", "success");
    } else {
      const ref = doc(collection(db, "screens"));
      await setDoc(ref, {
        ...base,
        screens_id: ref.id,
        assignees: [],
        current_status: "NotStarted",
        is_deleted: false,
        created_by: me.user_id,
        created_by_name: me.name,
        created_at: base.updated_at
      });
      showToast("เพิ่มหน้าจอใหม่แล้ว", "success");
    }
    setTimeout(() => { location.href = "scr-009.html"; }, 900);
  } catch (err) {
    console.error(err);
    showToast("บันทึกไม่สำเร็จ: " + (err.message || err), "danger");
  } finally {
    saving = false; $("btn-save").disabled = false;
  }
}

// ── ลบ (soft delete) ──
async function onDelete() {
  const cur = await getDoc(doc(db, "screens", screenId));
  const assignees = cur.exists() ? (cur.data().assignees || []) : [];
  if (assignees.length > 0) {
    await openModal({
      title: "ลบหน้าจอไม่ได้",
      bodyHtml: `<p>หน้าจอนี้ยังมีผู้รับผิดชอบ ${assignees.length} คน (${assignees.map((a) => esc(a.user_name)).join(", ")}) กรุณายกเลิกการมอบหมายที่ SCR-013 ก่อนจึงจะลบได้</p>`,
      confirmText: "รับทราบ"
    });
    return;
  }
  const ok = await openModal({
    title: "ยืนยันการลบหน้าจอ",
    bodyHtml: `<p>ต้องการลบหน้าจอ <strong>${esc(loaded.code)} — ${esc(loaded.name)}</strong> หรือไม่? (ลบแบบซ่อน กู้คืนผ่านฐานข้อมูลได้)</p>`,
    confirmText: "ลบหน้าจอ", danger: true
  });
  if (!ok) return;
  try {
    await updateDoc(doc(db, "screens", screenId), { is_deleted: true, updated_at: nowIso() });
    showToast("ลบหน้าจอแล้ว", "success");
    setTimeout(() => { location.href = "scr-009.html"; }, 900);
  } catch (err) {
    showToast("ลบไม่สำเร็จ: " + (err.message || err), "danger");
  }
}

// ── AI แนะนำประเภท ──
async function onAi() {
  const name = $("name").value.trim();
  const description = $("description").value.trim();
  if (!description) { showToast("กรุณากรอกคำอธิบายก่อนให้ AI ช่วยแนะนำ", "warning"); $("description").focus(); return; }
  if (!(await loadAiConfig())) { showToast("ยังไม่ได้ตั้งค่า OpenRouter (ฟีเจอร์ AI ใช้ได้เฉพาะตอนรันบนเครื่องที่มี openrouter-config.js)", "warning"); return; }
  const typeList = types.map((t) => ({ type_id: t.code, label: t.label }));
  const messages = [
    { role: "system", content: "You classify UI screens of a software project. Reply with JSON only: {\"type_id\": string, \"confidence\": number 0-1, \"reason\": string (Thai, short)}. type_id must be one of the provided type_id values." },
    { role: "user", content: JSON.stringify({ name, description, types: typeList }) }
  ];
  $("btn-ai").disabled = true; $("ai-spinner").classList.remove("hidden");
  try {
    const { raw, parsed } = await callOpenRouter(messages);
    await logAi(screenId, { source: "screenType", input: messages, output: { raw, parsed } }, me);
    const t = types.find((x) => x.code === parsed.type_id);
    if (!t) throw new Error("AI ตอบประเภทที่ไม่อยู่ในรายการ: " + parsed.type_id);
    const confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0));
    proposal = { type: t, confidence, reason: parsed.reason || "" };
    $("ai-area").innerHTML = aiProposalHtml({
      title: "แนะนำประเภทหน้าจอ",
      bodyHtml: `<p>ประเภทที่แนะนำ: <strong>${esc(t.label)}</strong></p>`,
      confidence, reason: proposal.reason
    });
  } catch (err) {
    console.error(err);
    await logAi(screenId, { source: "screenType", input: messages, error: err.message || err }, me);
    showToast("AI แนะนำไม่สำเร็จ: " + (err.message || err), "danger");
  } finally {
    $("btn-ai").disabled = false; $("ai-spinner").classList.add("hidden");
  }
}

function onAiArea(e) {
  const act = e.target.closest("[data-act]")?.dataset.act;
  if (!act || !proposal) return;
  if (act === "ai-confirm") {
    $("type").value = proposal.type.code;
    aiConfirmedType = proposal.type.code;
    origin = "AIGenerated"; aiConfidence = proposal.confidence; isSuggested = false;
    pendingAiSuggestion = {
      summary: `แนะนำประเภท ${proposal.type.label}: ${proposal.reason}`,
      source: "screenType", confidence: proposal.confidence, createdAt: nowIso()
    };
    updateTypeHint();
    showToast("นำประเภทที่ AI แนะนำมาใช้แล้ว (กดบันทึกเพื่อยืนยันขั้นสุดท้าย)", "success");
  }
  proposal = null;
  $("ai-area").innerHTML = "";
}

$("screen-form").addEventListener("submit", onSave);
$("btn-ai").addEventListener("click", onAi);
$("ai-area").addEventListener("click", onAiArea);
$("type").addEventListener("change", () => {
  if ($("type").value) setError("f-type", "");
  if ($("type").value !== aiConfirmedType) {
    if (aiConfirmedType) aiConfirmedType = null;
    if (isEdit && $("type").value === (loaded.type?.type_id || "")) {
      origin = loaded.origin_label || "ManualEntry"; aiConfidence = loaded.ai_confidence ?? null; isSuggested = !!loaded.is_suggested;
    } else { origin = "ManualEntry"; aiConfidence = null; isSuggested = false; }
    updateTypeHint();
  }
});

try { await init(); } catch (err) {
  console.error(err);
  $("loading").innerHTML = `<div class="info-banner danger">โหลดข้อมูลไม่สำเร็จ: ${esc(err.message || err)}</div>`;
}
