// js/screen-assign.js — SCR-013 มอบหมายผู้รับผิดชอบ (batch + AI แนะนำ)
import { db } from "./firebase-config.js";
import {
  collection, doc, getDoc, getDocs, writeBatch, query, orderBy, limit
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { requireAuth, renderShell, showToast, openModal, esc, nowIso, formatDateTime } from "./common.js";
import { PAGE, canAssign, canAssignFor, filterScreensForRole, denyAccessAndRedirect } from "./acl.js";
import { loadAiConfig, callOpenRouter, logAi, aiProposalHtml } from "./ai.js";

const me = await requireAuth();
renderShell(PAGE.SCR013);
if (!canAssign(me.role)) { denyAccessAndRedirect(); throw new Error("no access"); }

const $ = (id) => document.getElementById(id);
const WORK_ROLES = ["SA", "BA", "Dev", "Tester"];

let allScreens = [];          // ทุกหน้าจอที่ไม่ถูกลบ (ใช้คำนวณภาระงาน)
let users = [];               // [{user_id,name,role,email}]
const selected = new Map();   // id -> { loadedUpdatedAt, data, assignees(working), dirty, aiSuggestion }
let proposal = null;          // { screenId, entry, summary }
let saving = false;

const workload = (uid) => allScreens.filter((s) => (s.assignees || []).some((a) => a.user_id === uid)).length;
const allowed = (s) => canAssignFor(me.role, s, me.user_id);

function pickableScreens() {
  return filterScreensForRole(allScreens, me.role, me.user_id).filter(allowed);
}

function addSelected(s) {
  if (selected.has(s.screens_id)) return;
  selected.set(s.screens_id, {
    loadedUpdatedAt: s.updated_at, data: s,
    assignees: (s.assignees || []).map((a) => ({ ...a })), dirty: false, aiSuggestion: null
  });
}

// ── Render ──
function chipsHtml(id, list) {
  if (!list.length) return '<span class="muted">ยังไม่มีผู้รับผิดชอบ</span>';
  return list.map((a, i) => `<span class="assignee-chip">${esc(a.user_name)} <span class="assignee-role">${esc(a.role)}</span>${a.origin_label === "AIGenerated" ? ' <span class="ai-badge">AI</span>' : ""}<button type="button" class="chip-remove" data-act="unassign" data-id="${esc(id)}" data-idx="${i}" title="ยกเลิกการมอบหมาย" aria-label="ยกเลิกการมอบหมาย">✕</button></span>`).join(" ");
}

function renderPicker() {
  const q = $("picker-search").value.trim().toLowerCase();
  const rows = pickableScreens().filter((s) => !selected.has(s.screens_id) &&
    (!q || `${s.code} ${s.name}`.toLowerCase().includes(q)))
    .sort((a, b) => String(a.code).localeCompare(String(b.code)));
  $("picker-body").innerHTML = rows.length ? rows.map((s) => `<tr>
    <td class="col-check"><input type="checkbox" class="pick" value="${esc(s.screens_id)}"></td>
    <td><span class="code-label">${esc(s.code)}</span></td><td>${esc(s.name)}</td>
    <td>${(s.assignees || []).map((a) => `<span class="assignee-chip">${esc(a.user_name)} <span class="assignee-role">${esc(a.role)}</span></span>`).join(" ") || '<span class="muted">-</span>'}</td>
  </tr>`).join("") : `<tr><td colspan="4"><div class="empty-state">ไม่มีหน้าจอให้เลือก</div></td></tr>`;
}

function renderSelected() {
  $("sel-count").textContent = selected.size;
  $("selected-list").innerHTML = selected.size ? [...selected.entries()].map(([id, v]) => `
    <div class="row" style="justify-content:space-between;align-items:flex-start;padding:8px 0;border-bottom:1px solid var(--border,#eee)">
      <div><span class="code-label">${esc(v.data.code)}</span> ${esc(v.data.name)}
        ${v.dirty ? '<span class="tag tag-warning">ยังไม่บันทึก</span>' : ""}
        <div style="margin-top:6px">${chipsHtml(id, v.assignees)}</div></div>
      <button type="button" class="btn btn-ghost btn-sm" data-act="remove-screen" data-id="${esc(id)}">นำออกจากรายการ</button>
    </div>`).join("") : `<div class="empty-state">ยังไม่ได้เลือกหน้าจอ — เลือกจากตารางด้านบน</div>`;
  const cur = $("ai-screen").value;
  $("ai-screen").innerHTML = `<option value="">— เลือกหน้าจอ —</option>` + [...selected.entries()].map(([id, v]) =>
    `<option value="${esc(id)}">${esc(v.data.code)} — ${esc(v.data.name)}</option>`).join("");
  if (selected.has(cur)) $("ai-screen").value = cur;
  $("btn-save").disabled = ![...selected.values()].some((v) => v.dirty);
}

function renderUsers() {
  $("user-list").innerHTML = users.length ? users.map((u) => `<label class="checkbox-row">
    <input type="checkbox" class="pick-user" value="${esc(u.user_id)}">
    <span>${esc(u.name)} <span class="muted">(${esc(u.role || "-")}${u.user_id === me.user_id ? " · ตัวคุณเอง" : ""}) · ภาระงาน ${workload(u.user_id)} หน้าจอ</span></span>
  </label>`).join("") : '<div class="muted">ไม่พบผู้ใช้ที่ใช้งานอยู่</div>';
}

// ── Actions ──
function applyBatch() {
  const uids = [...document.querySelectorAll(".pick-user:checked")].map((c) => c.value);
  const role = $("work-role").value;
  if (!selected.size) return showToast("กรุณาเลือกหน้าจออย่างน้อย 1 หน้าจอ", "warning");
  if (!uids.length) return showToast("กรุณาเลือกผู้รับผิดชอบอย่างน้อย 1 คน", "warning");
  let added = 0, skipped = 0;
  for (const v of selected.values()) {
    for (const uid of uids) {
      const u = users.find((x) => x.user_id === uid);
      if (!u) continue;
      if (v.assignees.some((a) => a.user_id === uid && a.role === role)) { skipped++; continue; }
      v.assignees.push({
        user_id: u.user_id, user_name: u.name, role, assigned_by: me.user_id, assigned_at: nowIso(),
        origin_label: "ManualEntry", ai_confidence: null, ai_reason: null
      });
      v.dirty = true; added++;
    }
  }
  renderSelected();
  showToast(`เพิ่ม ${added} รายการ${skipped ? ` (ข้าม ${skipped} รายการที่ซ้ำ)` : ""} — กดบันทึกเพื่อยืนยัน`, added ? "success" : "info");
}

async function save() {
  if (saving) return;
  saving = true; $("btn-save").disabled = true;
  try {
    const dirtyIds = [...selected.entries()].filter(([, v]) => v.dirty).map(([id]) => id);
    const conflicts = [];
    const batch = writeBatch(db);
    const now = nowIso();
    const okIds = [];
    for (const id of dirtyIds) {
      const v = selected.get(id);
      const cur = await getDoc(doc(db, "screens", id));
      if (!cur.exists() || cur.data().is_deleted || cur.data().updated_at !== v.loadedUpdatedAt) {
        conflicts.push(id); continue;
      }
      const patch = { assignees: v.assignees, updated_at: now };
      if (v.aiSuggestion) patch.aiSuggestion = v.aiSuggestion;
      batch.update(doc(db, "screens", id), patch);
      okIds.push(id);
    }
    if (okIds.length) await batch.commit();
    for (const id of okIds) {
      const v = selected.get(id);
      v.loadedUpdatedAt = now; v.dirty = false; v.aiSuggestion = null;
      v.data = { ...v.data, assignees: v.assignees, updated_at: now };
      const i = allScreens.findIndex((s) => s.screens_id === id);
      if (i >= 0) allScreens[i] = v.data;
    }
    if (okIds.length) showToast(`บันทึกแล้ว ${okIds.length} หน้าจอ`, "success");
    if (conflicts.length) {
      await openModal({
        title: "มีข้อมูลถูกแก้ไขโดยผู้อื่น",
        bodyHtml: `<p>หน้าจอต่อไปนี้ถูกแก้ไข/ลบโดยผู้อื่นระหว่างที่คุณกำลังทำงาน ระบบไม่เขียนทับ และจะโหลดข้อมูลล่าสุดใหม่ (การเปลี่ยนแปลงของคุณในหน้าจอเหล่านี้ถูกยกเลิก):</p><ul>${conflicts.map((id) => `<li>${esc(selected.get(id).data.code)}</li>`).join("")}</ul>`,
        confirmText: "โหลดข้อมูลล่าสุด"
      });
      for (const id of conflicts) {
        const cur = await getDoc(doc(db, "screens", id));
        if (!cur.exists() || cur.data().is_deleted) { selected.delete(id); continue; }
        const data = { ...cur.data(), screens_id: cur.id };
        selected.delete(id); addSelected(data);
        const i = allScreens.findIndex((s) => s.screens_id === id);
        if (i >= 0) allScreens[i] = data;
      }
    }
    renderSelected(); renderPicker(); renderUsers();
  } catch (err) {
    console.error(err);
    showToast("บันทึกไม่สำเร็จ: " + (err.message || err), "danger");
  } finally {
    saving = false;
    $("btn-save").disabled = ![...selected.values()].some((v) => v.dirty);
  }
}

// ── AI ──
async function onAi() {
  const id = $("ai-screen").value;
  if (!id) return showToast("กรุณาเลือกหน้าจอที่จะให้ AI แนะนำ", "warning");
  if (!(await loadAiConfig())) return showToast("ยังไม่ได้ตั้งค่า OpenRouter (ฟีเจอร์ AI ใช้ได้เฉพาะตอนรันบนเครื่องที่มี openrouter-config.js)", "warning");
  const v = selected.get(id);
  $("btn-ai").disabled = true; $("ai-spinner").classList.remove("hidden");
  let messages = null;
  try {
    let history = [];
    try {
      const hs = await getDocs(query(collection(db, "screens", id, "statusHistory"), orderBy("changed_at", "desc"), limit(5)));
      history = hs.docs.map((d) => { const h = d.data(); return { changed_by: h.changed_by, changed_by_name: h.changed_by_name, changed_at: h.changed_at, old_status: h.old_status, new_status: h.new_status }; });
    } catch (e) { console.warn("อ่านประวัติสถานะไม่สำเร็จ", e); }
    const payload = {
      screen: { code: v.data.code, name: v.data.name, description: v.data.description || "", type: v.data.type?.label || null, current_status: v.data.current_status, current_assignees: v.assignees.map((a) => ({ user_id: a.user_id, name: a.user_name, role: a.role })) },
      candidates: users.map((u) => ({ user_id: u.user_id, name: u.name, user_role: u.role, current_workload: workload(u.user_id) })),
      recent_status_history: history,
      work_roles: WORK_ROLES
    };
    messages = [
      { role: "system", content: "You recommend one assignee for a software screen. Consider workload (lower is better), the person's role and who recently worked on the screen. Reply with JSON only: {\"user_id\": string (from candidates), \"role\": one of SA|BA|Dev|Tester, \"confidence\": number 0-1, \"reason\": string (Thai, short)}." },
      { role: "user", content: JSON.stringify(payload) }
    ];
    const { raw, parsed } = await callOpenRouter(messages);
    await logAi(id, { source: "assignee", input: messages, output: { raw, parsed } }, me);
    const u = users.find((x) => x.user_id === parsed.user_id);
    if (!u) throw new Error("AI แนะนำผู้ใช้ที่ไม่อยู่ในรายการ: " + parsed.user_id);
    if (!WORK_ROLES.includes(parsed.role)) throw new Error("AI ตอบบทบาทไม่ถูกต้อง: " + parsed.role);
    const confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0));
    proposal = {
      screenId: id, user: u, role: parsed.role, confidence, reason: parsed.reason || "",
    };
    $("ai-area").innerHTML = aiProposalHtml({
      title: `แนะนำผู้รับผิดชอบสำหรับ ${v.data.code}`,
      bodyHtml: `<p><strong>${esc(u.name)}</strong> ในบทบาท <strong>${esc(parsed.role)}</strong> · ภาระงานปัจจุบัน ${workload(u.user_id)} หน้าจอ</p>`,
      confidence, reason: proposal.reason
    });
  } catch (err) {
    console.error(err);
    await logAi(id, { source: "assignee", input: messages || "(สร้าง prompt ไม่สำเร็จ)", error: err.message || err }, me);
    showToast("AI แนะนำไม่สำเร็จ: " + (err.message || err), "danger");
  } finally {
    $("btn-ai").disabled = false; $("ai-spinner").classList.add("hidden");
  }
}

function onAiArea(e) {
  const act = e.target.closest("[data-act]")?.dataset.act;
  if (!act || !proposal) return;
  if (act === "ai-confirm") {
    const v = selected.get(proposal.screenId);
    if (v.assignees.some((a) => a.user_id === proposal.user.user_id && a.role === proposal.role)) {
      showToast("ผู้รับผิดชอบคนนี้ในบทบาทนี้มีอยู่แล้ว", "info");
    } else {
      v.assignees.push({
        user_id: proposal.user.user_id, user_name: proposal.user.name, role: proposal.role,
        assigned_by: me.user_id, assigned_at: nowIso(), origin_label: "AIGenerated",
        ai_confidence: proposal.confidence, ai_reason: proposal.reason
      });
      v.aiSuggestion = {
        summary: `แนะนำ ${proposal.user.name} (${proposal.role}): ${proposal.reason}`,
        source: "assignee", confidence: proposal.confidence, createdAt: nowIso()
      };
      v.dirty = true;
      renderSelected();
      showToast("เพิ่มผู้รับผิดชอบตามที่ AI แนะนำแล้ว — กดบันทึกเพื่อยืนยัน", "success");
    }
  }
  proposal = null; $("ai-area").innerHTML = "";
}

// ── Init ──
async function init() {
  const [sSnap, uSnap] = await Promise.all([getDocs(collection(db, "screens")), getDocs(collection(db, "users"))]);
  allScreens = sSnap.docs.map((d) => ({ ...d.data(), screens_id: d.id })).filter((s) => !s.is_deleted);
  users = uSnap.docs.map((d) => ({ user_id: d.id, ...d.data() })).filter((u) => u.is_active !== false)
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));

  const ids = (new URLSearchParams(location.search).get("ids") || "").split(",").map((x) => x.trim()).filter(Boolean);
  let skipped = 0;
  for (const id of ids) {
    const s = allScreens.find((x) => x.screens_id === id);
    if (s && filterScreensForRole([s], me.role, me.user_id).length && allowed(s)) addSelected(s); else skipped++;
  }
  if (skipped) showToast(`ข้าม ${skipped} หน้าจอที่ไม่พบหรือคุณไม่มีสิทธิ์มอบหมาย`, "warning");

  renderPicker(); renderSelected(); renderUsers();
  $("loading").classList.add("hidden");
  $("content").classList.remove("hidden");
}

$("picker-search").addEventListener("input", renderPicker);
$("btn-add-picked").addEventListener("click", () => {
  const picked = [...document.querySelectorAll(".pick:checked")].map((c) => c.value);
  if (!picked.length) return showToast("กรุณาติ๊กเลือกหน้าจอ", "warning");
  for (const id of picked) { const s = allScreens.find((x) => x.screens_id === id); if (s) addSelected(s); }
  renderPicker(); renderSelected();
});
$("selected-list").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-act]");
  if (!btn) return;
  const v = selected.get(btn.dataset.id);
  if (!v) return;
  if (btn.dataset.act === "unassign") {
    if (!allowed(v.data)) return showToast("คุณไม่มีสิทธิ์ยกเลิกการมอบหมายหน้าจอนี้", "warning");
    v.assignees.splice(Number(btn.dataset.idx), 1);
    v.dirty = true;
  } else if (btn.dataset.act === "remove-screen") {
    if (v.dirty && !confirm("มีการเปลี่ยนแปลงที่ยังไม่บันทึกในหน้าจอนี้ ต้องการนำออกและทิ้งการเปลี่ยนแปลงหรือไม่?")) return;
    selected.delete(btn.dataset.id);
    if (proposal?.screenId === btn.dataset.id) { proposal = null; $("ai-area").innerHTML = ""; }
    renderPicker();
  }
  renderSelected();
});
$("btn-apply").addEventListener("click", applyBatch);
$("btn-save").addEventListener("click", save);
$("btn-ai").addEventListener("click", onAi);
$("ai-area").addEventListener("click", onAiArea);

try { await init(); } catch (err) {
  console.error(err);
  $("loading").innerHTML = `<div class="info-banner danger">โหลดข้อมูลไม่สำเร็จ: ${esc(err.message || err)}</div>`;
}
