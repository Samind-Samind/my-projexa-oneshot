// e2e/create-test-accounts.mjs — สร้างบัญชีทดสอบ 5 บทบาท (PM/BA/SA/DEV/IMP)
// สำหรับ sub-agent `tester` — รันเองครั้งเดียว: node e2e/create-test-accounts.mjs
//
// - อ่าน Firebase config จาก app/js/firebase-config.js (ไฟล์ .gitignore อยู่แล้ว)
// - สร้าง Firebase Auth account + users/{uid} รูปแบบเดียวกับ signUp() ใน app/js/auth.js
// - สุ่มรหัสผ่านแล้วบันทึกลง e2e/test-accounts.local.json (ถูก .gitignore ด้วย
//   pattern *.local.json) — ห้าม commit ไฟล์นั้น
// - รันซ้ำได้: บัญชีที่มีอยู่แล้วจะถูกข้าม (ถ้ามีรหัสผ่านในไฟล์ local จะเช็คให้ว่ายังล็อกอินได้)
//
// ชื่อผู้ใช้ตั้งให้ตรงกับชื่อในข้อมูลตัวอย่าง (app/js/data.js) เพื่อให้กด seed.html
// ต่อได้ถ้าต้องการ (ล็อกอินเป็นบัญชี BA แล้วกดปุ่มบนหน้า seed เอง)

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { initializeApp } from "firebase/app";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
} from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc, terminate } from "firebase/firestore";

const HERE = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(HERE, "..", "app", "js", "firebase-config.js");
const OUT_PATH = join(HERE, "test-accounts.local.json");

const ACCOUNTS = [
  { role: "PM",  email: "e2e-pm@example.com",  name: "พิมพ์ใจ ดีงาม" },
  { role: "BA",  email: "e2e-ba@example.com",  name: "ปรีชา มั่นคง" },
  { role: "SA",  email: "e2e-sa@example.com",  name: "วีระ ตรวจสอบ" },
  { role: "DEV", email: "e2e-dev@example.com", name: "สมชาย ใจดี" },
  { role: "IMP", email: "e2e-imp@example.com", name: "สมหญิง วิเคราะห์" },
];

function loadFirebaseConfig() {
  const src = readFileSync(CONFIG_PATH, "utf8");
  const m = src.match(/const\s+firebaseConfig\s*=\s*(\{[\s\S]*?\});/);
  if (!m) throw new Error(`หา firebaseConfig ใน ${CONFIG_PATH} ไม่เจอ`);
  const cfg = new Function(`return ${m[1]}`)();
  if (!cfg.apiKey || String(cfg.apiKey).startsWith("YOUR_")) {
    throw new Error("firebase-config.js ยังเป็นค่า placeholder — ใส่ค่าจริงจาก Firebase Console ก่อน");
  }
  return cfg;
}

function loadSaved() {
  if (!existsSync(OUT_PATH)) return { accounts: {} };
  return JSON.parse(readFileSync(OUT_PATH, "utf8"));
}

function save(data) {
  writeFileSync(OUT_PATH, JSON.stringify(data, null, 2) + "\n", "utf8");
}

const genPassword = () => randomBytes(12).toString("base64url");

const cfg = loadFirebaseConfig();
const app = initializeApp(cfg);
const auth = getAuth(app);
const db = getFirestore(app);

const saved = loadSaved();
saved.projectId = cfg.projectId;
saved.baseUrl = saved.baseUrl || `https://${cfg.projectId}.web.app`;
saved.note = "ไฟล์นี้มีรหัสผ่านบัญชีทดสอบ — ห้าม commit (ถูก .gitignore ด้วย *.local.json)";

console.log(`Firebase project: ${cfg.projectId}\n`);

let failed = 0;
for (const acc of ACCOUNTS) {
  const label = `${acc.role.padEnd(3)} ${acc.email}`;
  const prev = saved.accounts[acc.role];
  try {
    const password = genPassword();
    const cred = await createUserWithEmailAndPassword(auth, acc.email, password);
    await setDoc(doc(db, "users", cred.user.uid), {
      name: acc.name, email: acc.email, role: acc.role, is_active: true,
    });
    saved.accounts[acc.role] = { email: acc.email, password, name: acc.name, uid: cred.user.uid };
    save(saved);
    console.log(`✔ สร้างแล้ว   ${label}`);
  } catch (err) {
    if (err.code !== "auth/email-already-in-use") {
      failed++;
      console.error(`✘ ล้มเหลว    ${label} — ${err.code || err.message}`);
      continue;
    }
    if (!prev?.password) {
      failed++;
      console.warn(`! มีอยู่แล้ว  ${label} — แต่ไม่มีรหัสผ่านในไฟล์ local (ลบบัญชีนี้ใน Firebase Console แล้วรันใหม่)`);
      continue;
    }
    try {
      const cred = await signInWithEmailAndPassword(auth, acc.email, prev.password);
      const ref = doc(db, "users", cred.user.uid);
      if (!(await getDoc(ref)).exists()) {
        await setDoc(ref, { name: acc.name, email: acc.email, role: acc.role, is_active: true });
      }
      console.log(`• มีอยู่แล้ว  ${label} (ล็อกอินได้ปกติ)`);
    } catch (e) {
      failed++;
      console.error(`✘ มีอยู่แล้วแต่ล็อกอินไม่ได้ ${label} — ${e.code || e.message}`);
    }
  } finally {
    await signOut(auth).catch(() => {});
  }
}

save(saved);
await terminate(db);
console.log(`\nบันทึกบัญชีไว้ที่ ${OUT_PATH}`);
process.exit(failed ? 1 : 0);
