# spec.md — ข้อกำหนด (Specification) ของโมดูล Screen Tracking

> เอกสารนี้สรุปจาก [SCOPE.md](SCOPE.md), [ACL.md](ACL.md) และซอร์สโค้ดจริงใน
> [`app/`](app/) (ไม่ใช่จากเอกสารออกแบบระบบ Projexa เต็มรูปแบบ) — ยึดพฤติกรรม
> ที่โค้ดทำงานจริงเป็นหลัก ถ้าจุดใดต่างจากเอกสารออกแบบอื่น (เช่น
> `docs/02-design/02-technical/screen-tracking-nosql-module.md` ซึ่งยังเขียน
> ไว้แบบโมเดล 3 บทบาทเดิม) ให้ถือว่า SCOPE.md/ACL.md/โค้ดปัจจุบัน (5 บทบาท)
> เป็นตัวล่าสุด ตามหมายเหตุ 2026-09-10 ใน SCOPE.md เอง
>
> **วันที่สร้าง:** 2026-09-21 · **สถานะ:** Draft — รอผู้ใช้ตรวจทาน

## 1. หน้าจอในสโคป

### 1.1 หน้าจอหลัก 4 หน้า (ตาม SCOPE.md)

| รหัส | ชื่อหน้าจอ | ไฟล์ | หน้าที่ |
|---|---|---|---|
| SCR-009 | ทะเบียนหน้าจอ | `scr-009.html` / `js/screen-registry.js` | แสดงรายการหน้าจอทั้งหมด (หรือเฉพาะที่ตนถูกมอบหมายสำหรับ DEV/IMP) กรองตามประเภท/สถานะ, เลือกหลายแถวเพื่อส่งต่อไปมอบหมาย, ลิงก์ไปแก้ไข/บันทึกความก้าวหน้าตามสิทธิ์ |
| SCR-010 | รายละเอียดหน้าจอ | `scr-010.html` / `js/screen-detail.js` | สร้างใหม่/แก้ไขข้อมูลหน้าจอ (รหัส/ชื่อ/คำอธิบาย/ประเภท), ปุ่ม "ให้ AI ช่วยแนะนำประเภท" (เรียก OpenRouter, ต้องกดยืนยันก่อนถึงจะนำไปใช้), ลบหน้าจอแบบ soft-delete (บล็อกถ้ายังมีผู้รับผิดชอบอยู่), ตรวจ concurrency ด้วย `updated_at` ตอนบันทึก |
| SCR-013 | มอบหมายผู้รับผิดชอบ | `scr-013.html` / `js/screen-assign.js` | มอบหมาย/ยกเลิกมอบหมายผู้รับผิดชอบแบบ batch (หลายหน้าจอพร้อมกัน), ปุ่ม "ให้ AI ช่วยแนะนำผู้รับผิดชอบ" (เลือกได้ทีละหน้าจอ, พิจารณาจากภาระงานและประวัติ `statusHistory`) |
| SCR-016 | บันทึกความก้าวหน้า | `scr-016.html` / `js/screen-progress.js` | เปลี่ยน `current_status` ผ่าน stepper 3 ขั้น, บังคับกรอกเหตุผล (`reason`) เมื่อเลือกสถานะที่ถอยหลังจากปัจจุบัน, มีช่อง `note` ไม่บังคับ, แสดงประวัติการเปลี่ยนสถานะทั้งหมด |

### 1.2 หน้าจอสนับสนุน (นอกสโคป 4 หน้าจอ แต่จำเป็นต่อการใช้งาน)

| หน้าจอ | ไฟล์ | หน้าที่ |
|---|---|---|
| เข้าสู่ระบบ | `login.html` / `js/login.js` | ล็อกอินด้วย Firebase Authentication (Email/Password) |
| สมัครสมาชิก | `signup.html` / `js/signup.js` | สร้างบัญชี Firebase Auth + เอกสาร `users` (เลือกบทบาทตอนสมัคร) |
| Seed ข้อมูลตัวอย่าง | `seed.html` / `js/seed.js` | เครื่องมือรันครั้งเดียวตอนตั้งค่าโปรเจกต์ ใส่ข้อมูลตัวอย่างขึ้น Firestore |
| Migrate schema | `migrate.html` / `js/migrate.js` | เครื่องมือรันครั้งเดียว (มือ) ย้ายเอกสาร `screens` เก่าที่ยัง id = `code` ให้เป็นสคีมาปัจจุบัน (id แบบ auto-generated + ฟิลด์ `screens_id`) |

ทุกหน้าจอยกเว้น `login.html`/`signup.html` ต้องล็อกอินก่อนใช้งาน (บังคับผ่าน
`js/common.js`)

## 2. โครงสร้างข้อมูล (Firestore Collections)

โครงสร้างจริงตามที่โค้ดอ่าน/เขียน (`app/js/screen-detail.js`,
`screen-assign.js`, `screen-progress.js`, `auth.js`) — collection ระดับบนสุด
ทั้งหมด 3 อัน + subcollection 2 อัน:

### `screens` (โฟลเดอร์หลัก — document id = Firestore auto-generated)

| ฟิลด์ | ชนิด | หมายเหตุ |
|---|---|---|
| `screens_id` | string | สำเนาของ document id ไว้ในตัวเอกสารเอง |
| `code` | string | รหัสหน้าจอ เช่น `SCR-101` — แก้ไขได้อิสระ ไม่ผูกกับ document id, ตรวจรหัสซ้ำด้วย query |
| `name` | string | ชื่อหน้าจอ |
| `description` | string | คำอธิบาย — เป็น input ให้ AI แนะนำประเภท |
| `type` | object `{type_id, label}` | denormalized snapshot จาก `screenTypes` |
| `assignees` | array of object | embedded array — ดูโครงสร้างด้านล่าง |
| `origin_label` | enum: `ManualEntry` / `AIGenerated` / `HumanConfirmed` | ที่มาของค่า `type` |
| `ai_confidence` | number \| null | ความมั่นใจของ AI ตอนแนะนำ `type` |
| `is_suggested` | boolean | ยังรอยืนยันค่าที่ AI แนะนำอยู่หรือไม่ |
| `current_status` | enum: `NotStarted` / `Analysis` / `Design` | สถานะปัจจุบัน |
| `is_deleted` | boolean | soft-delete |
| `created_by`, `created_by_name`, `created_at` | | ผู้สร้างและเวลาที่สร้าง |
| `updated_at` | ISO datetime string | ใช้เช็ค concurrency ตอนบันทึกทับ |
| `aiSuggestion` | object `{summary, source, confidence, createdAt}` (optional) | ผลแนะนำล่าสุดของ AI (ทั้งจาก SCR-010 และ SCR-013) เก็บไว้แสดงเป็นบันทึกล่าสุด — **ฟิลด์นี้ยังไม่ถูกพูดถึงใน CLAUDE.md/screen-tracking-nosql-module.md** พบจากโค้ดจริงเท่านั้น |

**`assignees[]` (embedded array แทนตาราง Assignment แยก):**

| ฟิลด์ | ชนิด | หมายเหตุ |
|---|---|---|
| `user_id` | reference → `users` | |
| `user_name` | string | denormalized snapshot ชื่อผู้รับผิดชอบ ณ ตอนมอบหมาย |
| `role` | enum: `SA` / `BA` / `Dev` / `Tester` | บทบาทในงานนี้ (คนละความหมายกับ `users.role` 5 ค่า) |
| `assigned_by` | reference → `users` | ผู้มอบหมาย |
| `assigned_at` | ISO datetime string | |
| `origin_label` | enum: `ManualEntry` / `AIGenerated` | ที่มาของการมอบหมายนี้ |
| `ai_confidence` | number \| null | ถ้ามาจาก AI |
| `ai_reason` | string \| null | เหตุผลที่ AI แนะนำคนนี้ |

**Subcollection `screens/{id}/statusHistory`** — ประวัติการเปลี่ยนสถานะ:

| ฟิลด์ | ชนิด | หมายเหตุ |
|---|---|---|
| `changed_by`, `changed_by_name` | | ผู้เปลี่ยนสถานะ |
| `changed_at` | ISO datetime string | |
| `old_status`, `new_status` | enum | |
| `reason` | string \| null | **บังคับกรอก** เมื่อถอยสถานะ |
| `note` | string \| null | ไม่บังคับ |

**Subcollection `screens/{id}/aiLog`** — log การเรียก AI ทุกครั้ง (สำเร็จ/ล้มเหลว)
ของทั้ง SCR-010 (`source: "screenType"`) และ SCR-013 (`source: "assignee"`):
`source`, `input` (prompt), `output` (raw + parsed หรือ null), `error`,
`created_by`, `created_by_name`, `createdAt` — **subcollection นี้ก็ยังไม่ถูก
พูดถึงใน CLAUDE.md เช่นกัน พบจากโค้ดจริง**

### `users` (โฟลเดอร์ประกอบ)

| ฟิลด์ | ชนิด | หมายเหตุ |
|---|---|---|
| `name` | string | |
| `email` | string | ใช้ผูกกับ Firebase Auth account |
| `role` | enum: `PM`/`BA`/`SA`/`DEV`/`IMP` | เลือกตอนสมัคร — เป็นแค่ label ข้อมูล ยังไม่บังคับสิทธิ์จริงใน `firestore.rules` |
| `is_active` | boolean | |

### `screenTypes` (โฟลเดอร์ประกอบ — master data, 5 ค่าคงที่)

`PROCESS` (Process) / `INQUIRY` (Inquiry) / `REPORTUI` (Report UI) /
`SERVICE` (Service) / `REPORT` (Report) — ฟิลด์ `code`, `label`, `is_active`

## 3. บทบาทผู้ใช้ (5 บทบาท)

| บทบาท | หน้าที่หลัก | เข้าถึงหน้าจอ |
|---|---|---|
| **PM** | ติดตามสถานะความคืบหน้า, ดูสรุปแดชบอร์ด | SCR-009 (ดูอย่างเดียว ทะเบียนทั้งหมด) |
| **BA** | เพิ่ม/แก้ไขทะเบียนหน้าจอ, มอบหมายงาน, บันทึกความก้าวหน้า | SCR-009, 010, 013, 016 |
| **SA** | เพิ่ม/แก้ไขทะเบียนหน้าจอ, มอบหมายงาน, บันทึกความก้าวหน้า (สิทธิ์เท่า BA ทุกประการ) | SCR-009, 010, 013, 016 |
| **DEV** | มอบหมายงาน, บันทึกความก้าวหน้า | SCR-009 (เฉพาะหน้าจอที่ตนถูกมอบหมาย), 013, 016 |
| **IMP** | บันทึกความก้าวหน้า | SCR-009 (เฉพาะหน้าจอที่ตนถูกมอบหมาย), 016 |

กติกาเพิ่มเติมที่บังคับจริงในโค้ด (`app/js/acl.js`, client-side UI gating
เท่านั้น — ไม่ใช่ `firestore.rules`):

- **DEV/IMP เห็นเฉพาะหน้าจอที่ตนถูกมอบหมาย** ไม่เห็นทะเบียนทั้งหมด
- **บันทึกความก้าวหน้าได้เฉพาะผู้ถูกมอบหมายจริง** ไม่ว่าจะมีบทบาทใดก็ตาม
- **มอบหมายงานให้ตัวเองได้** (self-assignment)
- รายละเอียดตารางสิทธิ์แบบเต็ม (การกระทำ × บทบาท) ดูที่ [ACL.md](ACL.md)

## 4. สิ่งที่ไม่ทำในโมดูลนี้ (ตัดออกจากสโคปรอบนี้)

- **สถานะที่เหลือของวงจรพัฒนาเต็มรูปแบบ** — `Development`, `UnitTest`, `SIT`,
  `UAT`, `Done`, `OnHold`, `Rework` (ใช้แค่ 3 ค่าแรก: NotStarted/Analysis/Design)
- **`Assignment` แบบตารางแยก** — ใช้ embedded array `assignees[]` แทน เพื่อไม่
  ให้เกิน "โฟลเดอร์ย่อย 1 อัน" ตามเงื่อนไขงานส่ง
- **ประเภทหน้าจอ (`screenType`) อื่น** นอกเหนือจาก 5 ค่าเริ่มต้น
- **Role-based access control จริง** — `firestore.rules` บังคับแค่
  `request.auth != null` เท่านั้น การกรอง/จำกัดสิทธิ์ตามบทบาท 5 แบบใน
  `js/acl.js` เป็นแค่ UI gating ฝั่ง client ไม่ใช่การบังคับใช้จริงระดับฐานข้อมูล
- **ลืมรหัสผ่าน/reset password** และการจัดการบัญชี (ลบ/ปิดใช้งาน) ผ่านหน้าแอป
  — ยังต้องทำผ่าน Firebase Console มือ
- **`module_id` / การจัดกลุ่มหน้าจอตาม Module** — ตัดออกทั้งหมดเพื่อไม่ให้เกิน
  เงื่อนไข "โฟลเดอร์ประกอบ 2 อัน" (กรอง/จัดกลุ่มได้แค่ตาม `type`/
  `current_status` เท่านั้น)
- **แดชบอร์ดสรุปภาพรวมโครงการของ PM** — ยังไม่มีหน้าจอนี้ในสโคป 4 หน้าจอปัจจุบัน
- **ขั้นตอนอนุมัติ (approve/reject gate) แยกต่างหาก** ก่อนเปลี่ยนสถานะมีผล —
  การบันทึกความก้าวหน้ามีผลทันทีที่ผู้ถูกมอบหมายกดบันทึก

## แหล่งอ้างอิง

- [SCOPE.md](SCOPE.md) — ตารางขอบเขตหลัก
- [ACL.md](ACL.md) — ตารางสิทธิ์แบบเต็ม
- [CLAUDE.md](CLAUDE.md) — คำแนะนำโปรเจกต์และข้อห้าม credential
- `docs/02-design/02-technical/screen-tracking-nosql-module-tech.md` — มติทาง
  เทคนิคเรื่อง client-side Web SDK
