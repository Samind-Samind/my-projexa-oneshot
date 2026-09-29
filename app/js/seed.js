// ─────────────────────────────────────────────────────────────
// js/seed.js — ใส่ข้อมูลตัวอย่างจาก js/data.js ขึ้น Firestore ครั้งเดียว
// รันจาก seed.html เท่านั้น ไม่ได้ใช้ในหน้าจอปกติของระบบ
// ─────────────────────────────────────────────────────────────

import { requireAuth, renderShell, showToast, nowIso } from "./common.js";
import { PAGE, denyAccessAndRedirect } from "./acl.js";
import { db } from "./firebase-config.js";
import { SCREEN_TYPES, SAMPLE_SCREENS } from "./data.js";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  addDoc,
  query,
  where
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

(async function init() {
  const me = await requireAuth();
  renderShell(PAGE.SCR009); // not a real SCR page, but for layout

  // ตรวจสิทธิ์: BA หรือ SA เท่านั้น
  if (me.role !== "BA" && me.role !== "SA") {
    document.querySelector(".main").innerHTML = `
      <div class="page-header"><h1 class="page-title">เข้าถึงไม่ได้</h1></div>
      <div class="card info-banner danger">
        <p>เพียง BA (นักวิเคราะห์ธุรกิจ) หรือ SA (นักวิเคราะห์ระบบ) เท่านั้นที่สามารถเข้าถึงหน้านี้ได้</p>
        <p>บทบาทปัจจุบันของคุณ: <strong>${me.role}</strong></p>
      </div>`;
    return;
  }

  // แสดงรายชื่อผู้ใช้
  const users = window.SEED_DATA?.users || [];
  const userList = document.getElementById("seed-user-reference");
  if (userList) {
    userList.innerHTML = users.map(u =>
      `<li>${u.name} — <code>${u.email}</code></li>`
    ).join("");
  }

  // ปุ่มเริ่ม
  document.getElementById("btn-seed").addEventListener("click", startSeed);
})();

async function startSeed() {
  const btn = document.getElementById("btn-seed");
  const logArea = document.getElementById("log-area");
  btn.disabled = true;
  logArea.textContent = "";

  try {
    log("รอตรวจสอบการล็อกอิน…");
    const me = await requireAuth();

    log("กำลังโหลดรายชื่อผู้ใช้จริงจาก Firestore…");
    const userSnapshot = await getDocs(collection(db, "users"));
    const nameToId = {};
    userSnapshot.forEach(docSnap => {
      nameToId[docSnap.data().name] = docSnap.id;
    });
    log(`✓ อ่านผู้ใช้ได้ ${userSnapshot.size} คน`);

    // ตรวจสอบว่าชื่อทั้งหมดมีอยู่ในระบบหรือไม่
    const requiredNames = new Set();
    SAMPLE_SCREENS.forEach(s => {
      s.assignees?.forEach(a => requiredNames.add(a.user_name));
      s.assignees?.forEach(a => requiredNames.add(a.assigned_by_name));
      s.statusHistory?.forEach(h => requiredNames.add(h.changed_by_name));
    });

    const missingNames = Array.from(requiredNames).filter(n => !nameToId[n]);
    if (missingNames.length > 0) {
      log(`\n❌ ไม่พบชื่อผู้ใช้เหล่านี้ในระบบ (ต้องสมัครสมาชิกก่อน):`);
      missingNames.forEach(n => log(`   - ${n}`));
      showToast(`ยังไม่มีชื่อ ${missingNames.join(", ")} ในระบบ กรุณาสมัครสมาชิกให้ครบก่อน`, "warning");
      return;
    }

    log("กำลังเขียน screenTypes…");
    for (const t of SCREEN_TYPES) {
      await setDoc(doc(db, "screenTypes", t.code), {
        code: t.code,
        label: t.label,
        is_active: t.is_active
      });
    }
    log(`✓ screenTypes ${SCREEN_TYPES.length} รายการ`);

    log("กำลังเขียน screens และ statusHistory…");
    let totalHistory = 0;
    for (const sampleScreen of SAMPLE_SCREENS) {
      // ตรวจสอบว่า code นี้มีเอกสารอยู่และไม่ได้ลบแล้วหรือไม่
      const existing = await getDocs(
        query(
          collection(db, "screens"),
          where("code", "==", sampleScreen.code),
          where("is_deleted", "==", false)
        )
      );
      if (existing.size > 0) {
        log(`⊘ ${sampleScreen.code} มีอยู่แล้ว ข้าม`);
        continue;
      }

      // สร้างเอกสาร screens ใหม่
      const newRef = doc(collection(db, "screens"));
      const screenType = SCREEN_TYPES.find(t => t.code === sampleScreen.type_id);

      const screenDoc = {
        screens_id: newRef.id,
        code: sampleScreen.code,
        name: sampleScreen.name,
        description: sampleScreen.description,
        type: {
          type_id: screenType.code,
          label: screenType.label
        },
        assignees: (sampleScreen.assignees || []).map(a => ({
          user_id: nameToId[a.user_name] || null,
          user_name: a.user_name,
          role: a.role,
          assigned_by: nameToId[a.assigned_by_name] || null,
          assigned_at: a.assigned_at,
          origin_label: "ManualEntry",
          ai_confidence: null,
          ai_reason: null
        })).filter(a => a.user_id !== null), // ลบรายการที่ไม่พบชื่อ
        origin_label: sampleScreen.origin_label,
        ai_confidence: sampleScreen.ai_confidence,
        is_suggested: sampleScreen.is_suggested,
        current_status: sampleScreen.current_status,
        is_deleted: false,
        created_by: me.user_id,
        created_by_name: me.name,
        created_at: nowIso(),
        updated_at: nowIso()
      };

      await setDoc(newRef, screenDoc);
      log(`✓ ${sampleScreen.code}: ${sampleScreen.name}`);

      // เขียน statusHistory ถ้ามี status != NotStarted
      for (const hist of (sampleScreen.statusHistory || [])) {
        await addDoc(
          collection(db, "screens", newRef.id, "statusHistory"),
          {
            changed_by: nameToId[hist.changed_by_name] || null,
            changed_by_name: hist.changed_by_name,
            changed_at: hist.changed_at,
            old_status: hist.old_status,
            new_status: hist.new_status,
            reason: hist.reason,
            note: hist.note
          }
        );
        totalHistory++;
      }
    }

    log(`✓ screens ${SAMPLE_SCREENS.length} รายการ`);
    log(`✓ statusHistory ${totalHistory} รายการ (subcollection)`);
    log("\n✓ เสร็จแล้ว — เปิด Firebase Console ตรวจสอบข้อมูลได้");
    showToast("ใส่ข้อมูลตัวอย่างสำเร็จ", "success");

  } catch (err) {
    log(`\n❌ เกิดข้อผิดพลาด: ${err.message}`);
    showToast("เกิดข้อผิดพลาด: " + err.message, "danger");
  } finally {
    btn.disabled = false;
  }
}

function log(msg) {
  const logArea = document.getElementById("log-area");
  logArea.textContent += msg + "\n";
  logArea.scrollTop = logArea.scrollHeight;
}
