// js/login.js — หน้าเข้าสู่ระบบ
import { auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { signIn, authErrorMessage } from "./auth.js";
import { showToast } from "./common.js";

const HOME = "scr-009.html";
const form = document.getElementById("login-form");
const errBox = document.getElementById("form-error");
const btn = document.getElementById("btn-login");
let busy = false;

try {
  const msg = sessionStorage.getItem("loginToast");
  if (msg) { sessionStorage.removeItem("loginToast"); showToast(msg, "warning"); }
} catch (e) { /* ignore */ }

// ถ้าล็อกอินอยู่แล้ว ข้ามไปหน้าทะเบียน
onAuthStateChanged(auth, (user) => { if (user && !busy) location.href = HOME; });

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errBox.hidden = true;
  const email = form.email.value.trim();
  const pw = form.password.value;
  if (!email || !pw) {
    errBox.textContent = "กรุณากรอกอีเมลและรหัสผ่าน";
    errBox.hidden = false;
    return;
  }
  busy = true;
  btn.disabled = true;
  btn.textContent = "กำลังเข้าสู่ระบบ...";
  try {
    await signIn(email, pw);
    location.href = HOME;
  } catch (err) {
    busy = false;
    errBox.textContent = authErrorMessage(err);
    errBox.hidden = false;
    btn.disabled = false;
    btn.textContent = "เข้าสู่ระบบ";
  }
});
