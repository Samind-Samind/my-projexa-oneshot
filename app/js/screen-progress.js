// SCR-016 บันทึกความก้าวหน้า
import { requireAuth, renderShell, showToast, formatDateTime, esc, nowIso, STATUSES, STATUS_LABEL, statusPill } from "./common.js";
import { PAGE, canAccessPage, canRecordProgressFor, denyAccessAndRedirect } from "./acl.js";
import { db } from "./firebase-config.js";
import {
  doc, getDoc, collection, getDocs, query, orderBy, writeBatch,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const me = await requireAuth();
renderShell(PAGE.SCR016);

if (!canAccessPage(me.role, PAGE.SCR016)) {
  denyAccessAndRedirect();
} else {
  init();
}

async function init() {
  const content = document.getElementById("content");
  const id = new URLSearchParams(location.search).get("id");
  const back = (msg) => {
    showToast(msg, "warning");
    setTimeout(() => { location.href = "scr-009.html"; }, 1500);
  };
  if (!id) return back("ไม่พบรหัสหน้าจอ");

  const screenRef = doc(db, "screens", id);
  let screen = null;
  let loadedUpdatedAt = null;
  let selected = null;

  async function loadScreen() {
    const snap = await getDoc(screenRef);
    if (!snap.exists() || snap.data().is_deleted === true) return null;
    return { ...snap.data(), id: snap.id };
  }

  async function loadHistory() {
    const q = query(collection(db, "screens", id, "statusHistory"), orderBy("changed_at", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
  }

  async function refresh() {
    try {
      screen = await loadScreen();
      if (!screen) return back("ไม่พบหน้าจอ หรือถูกลบแล้ว");
      loadedUpdatedAt = screen.updated_at ?? null;
      const history = await loadHistory();
      selected = null;
      render(history);
    } catch (err) {
      console.error(err);
      content.innerHTML = `<div class="info-banner danger">โหลดข้อมูลไม่สำเร็จ: ${esc(err.message || String(err))}</div>`;
    }
  }

  function render(history) {
    const editable = canRecordProgressFor(me.role, screen, me.user_id);
    const cur = screen.current_status || "NotStarted";
    const chips = (screen.assignees || []).map((a) =>
      `<span class="assignee-chip">${esc(a.user_name || "")} <span class="assignee-role">${esc(a.role || "")}</span></span>`).join(" ") || `<span class="muted">ยังไม่มีผู้รับผิดชอบ</span>`;

    const curIdx = STATUSES.indexOf(cur);
    const steps = STATUSES.map((s, i) => {
      const cls = s === cur ? "current" : i < curIdx ? "done" : "upcoming";
      return `<div class="step ${cls}" data-status="${s}" ${editable ? `role="button" tabindex="0" style="cursor:pointer"` : ""}>
        <div class="step-dot">${i + 1}</div><div class="step-label">${esc(STATUS_LABEL[s])}</div></div>`;
    }).join("");

    content.innerHTML = `
      <div class="card stack">
        <div class="card-title">ข้อมูลหน้าจอ</div>
        <div class="grid-2">
          <div class="kv"><div class="kv-label">รหัส</div><div class="kv-value"><span class="code-label">${esc(screen.code || "")}</span></div></div>
          <div class="kv"><div class="kv-label">ชื่อหน้าจอ</div><div class="kv-value">${esc(screen.name || "")}</div></div>
          <div class="kv"><div class="kv-label">ประเภท</div><div class="kv-value">${esc(screen.type?.label || "—")}</div></div>
          <div class="kv"><div class="kv-label">สถานะปัจจุบัน</div><div class="kv-value">${statusPill(cur)}</div></div>
        </div>
        <div class="kv"><div class="kv-label">ผู้รับผิดชอบ</div><div class="kv-value">${chips}</div></div>
      </div>

      <div class="card stack" style="margin-top:16px">
        <div class="card-title">เปลี่ยนสถานะ</div>
        ${editable ? "" : `<div class="info-banner warning">บันทึกได้เฉพาะผู้ถูกมอบหมาย</div>`}
        <div class="stepper" id="stepper">${steps}</div>
        ${editable ? `
        <form id="progress-form" novalidate class="stack">
          <div class="field" id="reason-field">
            <label for="reason">เหตุผล <span class="required hidden" id="reason-req">*</span></label>
            <textarea id="reason" rows="2" maxlength="500" placeholder="ระบุเหตุผลเมื่อย้อนสถานะกลับ"></textarea>
            <div class="field-hint">จำเป็นเมื่อเลือกสถานะที่ย้อนกลับจากสถานะปัจจุบัน</div>
            <div class="field-error" id="reason-error"></div>
          </div>
          <div class="field" id="note-field">
            <label for="note">หมายเหตุ <span class="required hidden" id="note-req">*</span></label>
            <textarea id="note" rows="2" maxlength="500"></textarea>
            <div class="field-hint">ไม่บังคับ ยกเว้นเมื่อบันทึกโดยไม่เปลี่ยนสถานะ</div>
            <div class="field-error" id="note-error"></div>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary" id="btn-save" disabled>บันทึก</button>
          </div>
        </form>` : ""}
      </div>

      <div class="card" style="margin-top:16px">
        <div class="card-title">ประวัติการเปลี่ยนสถานะ</div>
        ${history.length ? `<div class="timeline">${history.map((h) => `
          <div class="timeline-item"><div class="timeline-dot"></div><div class="timeline-body">
            <div class="timeline-head">${statusPill(h.old_status || "NotStarted")} → ${statusPill(h.new_status || "NotStarted")}</div>
            <div class="timeline-meta">${esc(h.changed_by_name || h.changed_by || "")} · ${esc(formatDateTime(h.changed_at))}</div>
            ${h.reason ? `<div class="timeline-note"><strong>เหตุผล:</strong> ${esc(h.reason)}</div>` : ""}
            ${h.note ? `<div class="timeline-note"><strong>หมายเหตุ:</strong> ${esc(h.note)}</div>` : ""}
          </div></div>`).join("")}</div>`
          : `<div class="empty-state"><div class="empty-title">ยังไม่มีประวัติการเปลี่ยนสถานะ</div></div>`}
      </div>`;

    if (editable) bindForm(cur);
  }

  function bindForm(cur) {
    const stepper = document.getElementById("stepper");
    const form = document.getElementById("progress-form");
    const saveBtn = document.getElementById("btn-save");
    const reason = document.getElementById("reason");
    const note = document.getElementById("note");
    const field = document.getElementById("reason-field");
    const errEl = document.getElementById("reason-error");
    const reqMark = document.getElementById("reason-req");
    const noteField = document.getElementById("note-field");
    const noteErr = document.getElementById("note-error");
    const noteReq = document.getElementById("note-req");

    const isBack = () => selected && STATUSES.indexOf(selected) < STATUSES.indexOf(cur);
    const isSame = () => selected === cur;
    function sync() {
      saveBtn.disabled = !selected;
      reqMark.classList.toggle("hidden", !isBack());
      if (!isBack()) { field.classList.remove("has-error"); errEl.textContent = ""; }
      noteReq.classList.toggle("hidden", !isSame());
      if (!isSame()) { noteField.classList.remove("has-error"); noteErr.textContent = ""; }
      stepper.querySelectorAll(".step").forEach((el) => {
        const chosen = el.dataset.status === selected;
        el.style.outline = chosen ? "2px solid currentColor" : "";
        el.style.outlineOffset = chosen ? "2px" : "";
        el.style.borderRadius = "8px";
      });
    }
    const pick = (el) => {
      const s = el?.closest(".step")?.dataset.status;
      if (!s) return;
      selected = s;
      sync();
    };
    stepper.addEventListener("click", (e) => pick(e.target));
    stepper.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(e.target); }
    });
    reason.addEventListener("input", () => {
      if (reason.value.trim()) { field.classList.remove("has-error"); errEl.textContent = ""; }
    });
    note.addEventListener("input", () => {
      if (note.value.trim()) { noteField.classList.remove("has-error"); noteErr.textContent = ""; }
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!selected) return;
      const reasonVal = reason.value.trim();
      const noteVal = note.value.trim();
      if (isSame() && !noteVal) {
        noteField.classList.add("has-error");
        noteErr.textContent = "กรุณากรอกหมายเหตุเมื่อบันทึกโดยไม่เปลี่ยนสถานะ";
        note.focus();
        return;
      }
      if (isBack() && !reasonVal) {
        field.classList.add("has-error");
        errEl.textContent = "กรุณาระบุเหตุผลเมื่อย้อนสถานะ";
        reason.focus();
        return;
      }
      saveBtn.disabled = true;
      saveBtn.textContent = "กำลังบันทึก...";
      try {
        const fresh = await getDoc(screenRef);
        if (!fresh.exists() || fresh.data().is_deleted === true) return back("หน้าจอนี้ถูกลบแล้ว");
        if ((fresh.data().updated_at ?? null) !== loadedUpdatedAt) {
          showToast("ข้อมูลถูกแก้ไขโดยผู้อื่นแล้ว กำลังโหลดใหม่", "warning");
          await refresh();
          return;
        }
        const now = nowIso();
        const histRef = doc(collection(db, "screens", id, "statusHistory"));
        const batch = writeBatch(db);
        batch.set(histRef, {
          changed_by: me.user_id,
          changed_by_name: me.name,
          changed_at: now,
          old_status: fresh.data().current_status || "NotStarted",
          new_status: selected,
          reason: reasonVal || null,
          note: noteVal || null,
        });
        batch.update(screenRef, { current_status: selected, updated_at: now });
        await batch.commit();
        showToast("บันทึกความก้าวหน้าเรียบร้อย", "success");
        await refresh();
      } catch (err) {
        console.error(err);
        showToast("บันทึกไม่สำเร็จ: " + (err.message || err), "danger");
        saveBtn.textContent = "บันทึก";
        sync();
      }
    });
    sync();
  }

  await refresh();
}
