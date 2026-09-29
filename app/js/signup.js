// js/signup.js — สมัครสมาชิก: สร้าง Auth account + users/{uid}
import { signUp, authErrorMessage } from "./auth.js";
import { ROLES } from "./acl.js";

const form = document.getElementById("signup-form");
const roleSel = document.getElementById("role");
const roleDesc = document.getElementById("role-desc");
const errBox = document.getElementById("form-error");
const btn = document.getElementById("btn-signup");

roleSel.innerHTML = '<option value="">— เลือกบทบาท —</option>' +
  Object.values(ROLES).map((r) => `<option value="${r.code}">${r.label} — ${r.desc}</option>`).join("");
roleSel.addEventListener("change", () => { roleDesc.textContent = ROLES[roleSel.value]?.desc || ""; });

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errBox.hidden = true;
  const name = form.name.value.trim();
  const email = form.email.value.trim();
  const password = form.password.value;
  const role = roleSel.value;
  let msg = "";
  if (!name || !email || !password || !role) msg = "กรุณากรอกข้อมูลให้ครบทุกช่องและเลือกบทบาท";
  else if (password.length < 6) msg = "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร";
  if (msg) { errBox.textContent = msg; errBox.hidden = false; return; }

  btn.disabled = true;
  btn.textContent = "กำลังสมัครสมาชิก...";
  try {
    await signUp({ name, email, password, role });
    location.href = "scr-009.html";
  } catch (err) {
    errBox.textContent = authErrorMessage(err);
    errBox.hidden = false;
    btn.disabled = false;
    btn.textContent = "สมัครสมาชิก";
  }
});
