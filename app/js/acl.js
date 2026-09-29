// js/acl.js — สิทธิ์ตามบทบาท (client-side UI gating ตาม ACL.md; ไม่ใช่ firestore.rules)

export const ROLES = {
  PM:  { code: "PM",  label: "PM",  desc: "ผู้จัดการโครงการ — ติดตามสถานะความคืบหน้า" },
  BA:  { code: "BA",  label: "BA",  desc: "นักวิเคราะห์ธุรกิจ — ดูแลทะเบียนหน้าจอและมอบหมายงาน" },
  SA:  { code: "SA",  label: "SA",  desc: "นักวิเคราะห์ระบบ — ดูแลทะเบียนหน้าจอและมอบหมายงาน" },
  DEV: { code: "DEV", label: "DEV", desc: "นักพัฒนา — มอบหมายงานและบันทึกความก้าวหน้า" },
  IMP: { code: "IMP", label: "IMP", desc: "ผู้นำระบบไปใช้ — บันทึกความก้าวหน้า" }
};

export const PAGE = { SCR009: "scr-009", SCR010: "scr-010", SCR013: "scr-013", SCR016: "scr-016" };

const PAGE_ACCESS = {
  PM:  [PAGE.SCR009],
  BA:  [PAGE.SCR009, PAGE.SCR010, PAGE.SCR013, PAGE.SCR016],
  SA:  [PAGE.SCR009, PAGE.SCR010, PAGE.SCR013, PAGE.SCR016],
  DEV: [PAGE.SCR009, PAGE.SCR013, PAGE.SCR016],
  IMP: [PAGE.SCR009, PAGE.SCR016]
};

export const canAccessPage = (role, page) => (PAGE_ACCESS[role] || []).includes(page);
export const canManageRegistry = (role) => role === "BA" || role === "SA";
export const canAssign = (role) => ["BA", "SA", "DEV"].includes(role);
export const canRecordProgressRole = (role) => ["BA", "SA", "DEV", "IMP"].includes(role);
export const isRegistryScoped = (role) => role === "DEV" || role === "IMP";

export function isAssignee(screen, userId) {
  return !!userId && (screen?.assignees || []).some((a) => a.user_id === userId);
}

// DEV ต้องเป็นผู้รับผิดชอบของหน้าจอนั้นอยู่แล้วจึงมอบหมายต่อได้
export function canAssignFor(role, screen, userId) {
  if (!canAssign(role)) return false;
  return role === "DEV" ? isAssignee(screen, userId) : true;
}

// บันทึกความก้าวหน้าได้เฉพาะผู้ถูกมอบหมาย
export function canRecordProgressFor(role, screen, userId) {
  return canRecordProgressRole(role) && isAssignee(screen, userId);
}

export function filterScreensForRole(screens, role, userId) {
  const list = (screens || []).filter((s) => !s.is_deleted);
  return isRegistryScoped(role) ? list.filter((s) => isAssignee(s, userId)) : list;
}

export function denyAccessAndRedirect() {
  import("./common.js").then(({ showToast }) =>
    showToast("คุณไม่มีสิทธิ์เข้าถึงหน้านี้ กำลังกลับไปทะเบียนหน้าจอ", "warning"));
  setTimeout(() => { location.href = "scr-009.html"; }, 1500);
}
