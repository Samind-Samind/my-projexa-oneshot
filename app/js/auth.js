// js/auth.js — Firebase Authentication (Email/Password) + โปรไฟล์ users/{uid}
import { auth, db } from "./firebase-config.js";
import {
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updateProfile
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? { user_id: snap.id, ...snap.data() } : null;
}

export async function signIn(email, pw) {
  const cred = await signInWithEmailAndPassword(auth, email, pw);
  return cred.user;
}

// สร้างบัญชี Auth + เอกสาร users/{uid}
export async function signUp({ name, email, password, role }) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  try { await updateProfile(cred.user, { displayName: name }); } catch (e) { /* ไม่สำคัญ */ }
  await setDoc(doc(db, "users", cred.user.uid), { name, email, role, is_active: true });
  return cred.user;
}

export function signOutUser() {
  return signOut(auth);
}

// แปลง error ของ Firebase เป็นข้อความไทย
export function authErrorMessage(err) {
  const map = {
    "auth/invalid-email": "รูปแบบอีเมลไม่ถูกต้อง",
    "auth/user-not-found": "ไม่พบบัญชีนี้ในระบบ",
    "auth/wrong-password": "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
    "auth/invalid-credential": "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
    "auth/user-disabled": "บัญชีนี้ถูกระงับการใช้งาน",
    "auth/too-many-requests": "พยายามหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่",
    "auth/network-request-failed": "เชื่อมต่อเครือข่ายไม่ได้ กรุณาลองใหม่",
    "auth/email-already-in-use": "อีเมลนี้ถูกใช้สมัครแล้ว",
    "auth/weak-password": "รหัสผ่านสั้นเกินไป (อย่างน้อย 6 ตัวอักษร)",
    "auth/operation-not-allowed": "ยังไม่ได้เปิดใช้ Email/Password ใน Firebase Console",
    "permission-denied": "ไม่มีสิทธิ์เขียนข้อมูล (ตรวจสอบ firestore.rules)"
  };
  return map[err?.code] || "เกิดข้อผิดพลาด: " + (err?.message || err);
}
