// js/common.js — utility ร่วมทุกหน้า: auth guard, sidebar, toast, modal, format
import { auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getUserProfile, signOutUser } from "./auth.js";
import { canAccessPage, PAGE } from "./acl.js";

export const STATUSES = ["NotStarted", "Analysis", "Design"];
export const STATUS_LABEL = { NotStarted: "Not Started", Analysis: "Analysis", Design: "Design" };

export const nowIso = () => new Date().toISOString();

const ESC_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export function esc(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ESC_MAP[c]);
}

export function formatDateTime(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d)) return "-";
  return d.toLocaleString("th-TH", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function statusPill(status) {
  const s = STATUSES.includes(status) ? status : "NotStarted";
  return `<span class="status-pill status-${s}">${esc(STATUS_LABEL[s])}</span>`;
}

// ── Toast ──
function toastRoot() {
  let el = document.getElementById("toast-root");
  if (!el) { el = document.createElement("div"); el.id = "toast-root"; document.body.appendChild(el); }
  return el;
}

export function showToast(message, type = "info") {
  const t = document.createElement("div");
  t.className = `toast toast-${type}`;
  t.setAttribute("role", "status");
  t.textContent = message;
  toastRoot().appendChild(t);
  setTimeout(() => { t.classList.add("toast-hide"); setTimeout(() => t.remove(), 250); }, 3500);
}

// ── Modal (คืน Promise<boolean>) ──
export function openModal({ title, bodyHtml = "", confirmText = "ยืนยัน", danger = false }) {
  return new Promise((resolve) => {
    const wrap = document.createElement("div");
    wrap.className = "modal-backdrop";
    wrap.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal-header"><h2>${esc(title)}</h2></div>
        <div class="modal-body">${bodyHtml}</div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-act="cancel">ยกเลิก</button>
          <button type="button" class="btn ${danger ? "btn-danger" : "btn-primary"}" data-act="ok">${esc(confirmText)}</button>
        </div>
      </div>`;
    const onKey = (e) => { if (e.key === "Escape") close(false); };
    const close = (v) => { document.removeEventListener("keydown", onKey); wrap.remove(); resolve(v); };
    wrap.addEventListener("click", (e) => {
      if (e.target === wrap) return close(false);
      const act = e.target.closest("[data-act]")?.dataset.act;
      if (act === "ok") close(true);
      if (act === "cancel") close(false);
    });
    document.addEventListener("keydown", onKey);
    document.body.appendChild(wrap);
    wrap.querySelector('[data-act="ok"]').focus();
  });
}

// ── Auth guard ──
let currentUser = null;

export function requireAuth() {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      unsub();
      if (!user) { location.href = "login.html"; return; }
      try {
        const p = await getUserProfile(user.uid);
        if (!p) {
          await signOutUser();
          try { sessionStorage.setItem("loginToast", "ไม่พบโปรไฟล์ผู้ใช้ กรุณาสมัครสมาชิกหรือติดต่อผู้ดูแล"); } catch (e) { /* ignore */ }
          location.href = "login.html";
          return;
        }
        currentUser = { uid: user.uid, user_id: user.uid, email: user.email, name: p.name, role: p.role };
        resolve(currentUser);
      } catch (e) {
        showToast("โหลดข้อมูลผู้ใช้ไม่สำเร็จ: " + (e?.message || e), "danger");
      }
    });
  });
}

// ── Sidebar ──
const NAV = [
  { page: PAGE.SCR009, href: "scr-009.html", label: "ทะเบียนหน้าจอ", code: "SCR-009" },
  { page: PAGE.SCR010, href: "scr-010.html", label: "เพิ่ม/แก้ไขหน้าจอ", code: "SCR-010" },
  { page: PAGE.SCR013, href: "scr-013.html", label: "มอบหมายผู้รับผิดชอบ", code: "SCR-013" },
  { page: PAGE.SCR016, href: "scr-016.html", label: "บันทึกความก้าวหน้า", code: "SCR-016" }
];

export function renderShell(activePage) {
  const side = document.getElementById("sidebar");
  if (!side) return;
  const user = currentUser;
  const links = NAV.filter((n) => !user || canAccessPage(user.role, n.page)).map((n) =>
    `<a class="nav-link${n.page === activePage ? " active" : ""}" href="${n.href}">
       <span class="nav-code">${n.code}</span><span>${esc(n.label)}</span></a>`).join("");
  side.classList.add("sidebar");
  side.innerHTML = `
    <div class="sidebar-brand"><img src="assets/logo-full.png" alt="Projexa"></div>
    <button type="button" class="sidebar-toggle" aria-label="เมนู">☰ เมนู</button>
    <nav class="sidebar-nav">${links}</nav>
    <div class="sidebar-user">
      <div class="sidebar-user-name">${esc(user?.name || "")}</div>
      <div class="sidebar-user-role">${esc(user?.role || "")}</div>
      <button type="button" class="btn btn-ghost btn-sm sidebar-logout" id="btn-logout">ออกจากระบบ</button>
    </div>`;
  side.querySelector(".sidebar-toggle").addEventListener("click", () => side.classList.toggle("open"));
  side.querySelector("#btn-logout").addEventListener("click", async () => {
    await signOutUser();
    location.href = "login.html";
  });
}
