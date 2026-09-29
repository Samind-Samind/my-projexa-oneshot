// ─────────────────────────────────────────────────────────────
// js/migrate.js — ย้ายเอกสาร screens เดิม (doc id = code หรือไม่มี screens_id)
// ไปใช้ doc id เป็น Firestore auto-generated id + ฟิลด์ screens_id แยกต่างหาก
// รันจาก migrate.html เท่านั้น ครั้งเดียวหลังอัปเดตโค้ด
// ─────────────────────────────────────────────────────────────

import { requireAuth, renderShell, showToast } from "./common.js";
import { PAGE, denyAccessAndRedirect } from "./acl.js";
import { db } from "./firebase-config.js";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  addDoc,
  updateDoc
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

  // ปุ่มควบคุม
  document.getElementById("btn-dryrun").addEventListener("click", () => startMigration(true));
  document.getElementById("btn-migrate").addEventListener("click", () => startMigration(false));
})();

async function startMigration(dryRun = false) {
  const btnDryRun = document.getElementById("btn-dryrun");
  const btnMigrate = document.getElementById("btn-migrate");
  const logArea = document.getElementById("log-area");

  btnDryRun.disabled = true;
  btnMigrate.disabled = true;
  logArea.textContent = "";

  try {
    log(dryRun ? "🔍 ตรวจสอบสคีมาเก่า (Dry Run)…" : "🔄 กำลังย้ายเอกสาร…");
    const me = await requireAuth();

    log("กำลังอ่านเอกสาร screens…");
    const snapshot = await getDocs(collection(db, "screens"));

    // หา screens ที่ต้องย้าย: doc id != screens_id หรือ screens_id ไม่มี
    const toMigrate = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (!data.screens_id || data.screens_id !== docSnap.id) {
        toMigrate.push({ oldId: docSnap.id, data });
      }
    });

    if (toMigrate.length === 0) {
      log("✓ ไม่พบเอกสารที่ต้องย้าย — ทุกเอกสารใช้ id ใหม่แล้ว");
      showToast("ไม่มีเอกสารที่ต้องย้าย", "info");
      return;
    }

    log(`พบ ${toMigrate.length} เอกสารที่ต้องย้าย:`);

    if (dryRun) {
      // Dry run: เพียงแสดงเท่านั้น
      for (const item of toMigrate) {
        log(`  ▸ ${item.oldId} (code: ${item.data.code || item.oldId})`);
      }
      log("\n✓ Dry run เสร็จ — กดปุ่มด้านบนเพื่อเริ่มย้ายข้อมูลจริง");
      showToast(`พบ ${toMigrate.length} เอกสารที่จะถูกย้าย`, "info");
      return;
    }

    // ย้ายจริง
    log("\n📝 เริ่มสร้างเอกสารใหม่และคัดลอกข้อมูล…");

    for (const item of toMigrate) {
      const oldId = item.oldId;
      const oldData = item.data;

      // สร้างเอกสาร screens ใหม่ด้วย auto-generated id
      const newRef = doc(collection(db, "screens"));
      const newData = {
        ...oldData,
        screens_id: newRef.id,
        code: oldData.code || oldId,
        is_deleted: false // เตรียม field นี้ถ้ายังไม่มี
      };

      // เขียนเอกสารใหม่
      await setDoc(newRef, newData);
      log(`✓ สร้างใหม่: ${oldId} → ${newRef.id}`);

      // คัดลอก statusHistory subcollection
      const historySnapshot = await getDocs(
        collection(db, "screens", oldId, "statusHistory")
      );
      for (const h of historySnapshot.docs) {
        await addDoc(
          collection(db, "screens", newRef.id, "statusHistory"),
          h.data()
        );
      }
      if (historySnapshot.size > 0) {
        log(`  ├─ statusHistory: ${historySnapshot.size} รายการ`);
      }

      // คัดลอก aiLog subcollection (ถ้ามี)
      const aiLogSnapshot = await getDocs(
        collection(db, "screens", oldId, "aiLog")
      );
      for (const a of aiLogSnapshot.docs) {
        await addDoc(
          collection(db, "screens", newRef.id, "aiLog"),
          a.data()
        );
      }
      if (aiLogSnapshot.size > 0) {
        log(`  └─ aiLog: ${aiLogSnapshot.size} รายการ`);
      }

      // ทำเครื่องหมาย soft-delete เอกสารเดิม (ไม่ hard delete)
      await updateDoc(doc(db, "screens", oldId), {
        is_deleted: true,
        is_deleted_at: new Date().toISOString(),
        is_deleted_by: me.user_id
      });
      log(`  ✓ ทำเครื่องหมาย soft-delete: ${oldId}`);
    }

    log(`\n✓ ย้ายเอกสาร ${toMigrate.length} รายการเสร็จแล้ว`);
    log("💾 เปิด Firebase Console ตรวจสอบข้อมูลได้");
    showToast("ย้ายข้อมูลสำเร็จ", "success");

  } catch (err) {
    const msg = `❌ เกิดข้อผิดพลาด: ${err.message}`;
    log(`\n${msg}`);
    showToast(msg, "danger");
  } finally {
    document.getElementById("btn-dryrun").disabled = false;
    document.getElementById("btn-migrate").disabled = false;
  }
}

function log(msg) {
  const logArea = document.getElementById("log-area");
  logArea.textContent += msg + "\n";
  logArea.scrollTop = logArea.scrollHeight;
}
