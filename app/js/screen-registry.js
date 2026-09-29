// SCR-009 ทะเบียนหน้าจอ
import { requireAuth, renderShell, showToast, formatDateTime, esc, STATUSES, STATUS_LABEL, statusPill } from "./common.js";
import {
  PAGE, canAccessPage, canManageRegistry, canAssign, canAssignFor,
  canRecordProgressFor, isRegistryScoped, filterScreensForRole, denyAccessAndRedirect,
} from "./acl.js";
import { db } from "./firebase-config.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const me = await requireAuth();
renderShell(PAGE.SCR009);

if (!canAccessPage(me.role, PAGE.SCR009)) {
  denyAccessAndRedirect();
} else {
  init();
}

async function init() {
  const $ = (id) => document.getElementById(id);
  const listArea = $("list-area");
  const canAdd = canManageRegistry(me.role);
  const canBulk = canAssign(me.role);
  let all = [];
  const selected = new Set();

  if (canAdd) $("btn-add").classList.remove("hidden");
  if (canBulk) $("btn-assign-selected").classList.remove("hidden");

  if (isRegistryScoped(me.role)) {
    const b = $("scope-banner");
    b.textContent = "คุณเห็นเฉพาะหน้าจอที่ถูกมอบหมายให้คุณเท่านั้น";
    b.classList.remove("hidden");
  } else if (me.role === "PM") {
    const b = $("scope-banner");
    b.textContent = "บทบาท PM: ดูข้อมูลได้อย่างเดียว";
    b.classList.remove("hidden");
  }

  const statusSel = $("f-status");
  STATUSES.forEach((s) => statusSel.insertAdjacentHTML("beforeend", `<option value="${esc(s)}">${esc(STATUS_LABEL[s])}</option>`));

  try {
    const [scrSnap, typeSnap] = await Promise.all([
      getDocs(collection(db, "screens")),
      getDocs(collection(db, "screenTypes")),
    ]);
    all = scrSnap.docs
      .map((d) => ({ ...d.data(), id: d.id }))
      .filter((s) => s.is_deleted !== true);
    all = filterScreensForRole(all, me.role, me.user_id);
    all.sort((a, b) => String(a.code || "").localeCompare(String(b.code || ""), "th", { numeric: true }));
    const typeSel = $("f-type");
    typeSnap.docs
      .map((d) => d.data())
      .filter((t) => t.is_active !== false)
      .forEach((t) => typeSel.insertAdjacentHTML("beforeend", `<option value="${esc(t.code)}">${esc(t.label)}</option>`));
  } catch (err) {
    console.error(err);
    listArea.innerHTML = `<div class="empty-state"><div class="empty-title">โหลดข้อมูลไม่สำเร็จ</div><div>${esc(err.message || String(err))}</div></div>`;
    showToast("โหลดทะเบียนหน้าจอไม่สำเร็จ", "danger");
    return;
  }

  function filtered() {
    const q = $("f-search").value.trim().toLowerCase();
    const t = $("f-type").value;
    const st = $("f-status").value;
    return all.filter((s) => {
      if (q && !(`${s.code || ""} ${s.name || ""}`.toLowerCase().includes(q))) return false;
      if (t && s.type?.type_id !== t) return false;
      if (st && s.current_status !== st) return false;
      return true;
    });
  }

  const selectable = (s) => canBulk && canAssignFor(me.role, s, me.user_id);

  function updateSelUi() {
    $("sel-count").textContent = selected.size;
    $("btn-assign-selected").disabled = selected.size === 0;
  }

  function render() {
    const rows = filtered();
    const visibleIds = new Set(rows.map((r) => r.id));
    [...selected].forEach((id) => { if (!visibleIds.has(id)) selected.delete(id); });

    if (!rows.length) {
      listArea.innerHTML = `<div class="empty-state"><div class="empty-title">ไม่พบหน้าจอ</div><div class="muted">${all.length ? "ลองปรับตัวกรองหรือคำค้นหา" : "ยังไม่มีหน้าจอในทะเบียน"}</div></div>`;
      $("list-footer").textContent = `แสดง 0 จาก ${all.length} รายการ`;
      updateSelUi();
      return;
    }
    const selRows = rows.filter(selectable);
    const showChecks = canBulk;
    const allChecked = selRows.length > 0 && selRows.every((r) => selected.has(r.id));
    const head = `<tr>${showChecks ? `<th class="col-check"><input type="checkbox" id="chk-all" ${allChecked ? "checked" : ""} ${selRows.length ? "" : "disabled"} aria-label="เลือกทั้งหมด"></th>` : ""}
      <th>รหัส</th><th>ชื่อหน้าจอ</th><th>ประเภท</th><th>ผู้รับผิดชอบ</th><th>สถานะ</th><th>อัปเดตล่าสุด</th><th>การดำเนินการ</th></tr>`;
    const body = rows.map((s) => {
      const chips = (s.assignees || []).map((a) =>
        `<span class="assignee-chip">${esc(a.user_name || "")} <span class="assignee-role">${esc(a.role || "")}</span></span>`).join(" ") || `<span class="muted">—</span>`;
      const acts = [];
      if (canManageRegistry(me.role)) acts.push(`<a class="btn btn-ghost btn-sm" href="scr-010.html?id=${encodeURIComponent(s.id)}">แก้ไข</a>`);
      if (canRecordProgressFor(me.role, s, me.user_id)) acts.push(`<a class="btn btn-ghost btn-sm" href="scr-016.html?id=${encodeURIComponent(s.id)}">บันทึกความก้าวหน้า</a>`);
      if (canAssignFor(me.role, s, me.user_id)) acts.push(`<a class="btn btn-ghost btn-sm" href="scr-013.html?ids=${encodeURIComponent(s.id)}">มอบหมาย</a>`);
      const chk = showChecks
        ? `<td class="col-check">${selectable(s) ? `<input type="checkbox" class="row-chk" data-id="${esc(s.id)}" ${selected.has(s.id) ? "checked" : ""} aria-label="เลือก ${esc(s.code)}">` : ""}</td>` : "";
      return `<tr class="${selected.has(s.id) ? "selected" : ""}">${chk}
        <td><span class="code-label">${esc(s.code || "")}</span></td>
        <td>${esc(s.name || "")}</td>
        <td>${esc(s.type?.label || "—")}</td>
        <td>${chips}</td>
        <td>${statusPill(s.current_status || "NotStarted")}</td>
        <td>${esc(formatDateTime(s.updated_at))}</td>
        <td><div class="row">${acts.join("") || `<span class="muted">—</span>`}</div></td></tr>`;
    }).join("");
    listArea.innerHTML = `<div class="table-wrap"><table class="table"><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
    $("list-footer").textContent = `แสดง ${rows.length} จาก ${all.length} รายการ`;
    updateSelUi();
  }

  listArea.addEventListener("change", (e) => {
    const t = e.target;
    if (t.id === "chk-all") {
      filtered().filter(selectable).forEach((r) => (t.checked ? selected.add(r.id) : selected.delete(r.id)));
      render();
    } else if (t.classList.contains("row-chk")) {
      if (t.checked) selected.add(t.dataset.id); else selected.delete(t.dataset.id);
      render();
    }
  });
  ["f-search", "f-type", "f-status"].forEach((id) => $(id).addEventListener("input", render));
  $("btn-assign-selected").addEventListener("click", () => {
    if (!selected.size) return showToast("กรุณาเลือกหน้าจออย่างน้อย 1 รายการ", "warning");
    location.href = `scr-013.html?ids=${[...selected].map(encodeURIComponent).join(",")}`;
  });

  render();
}
