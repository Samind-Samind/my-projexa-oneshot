# Projexa

🔗 **เว็บออนไลน์:** [https://projexa-oneshot.web.app/login](https://projexa-oneshot.web.app/login)

🧪 **ผลการทดสอบ:** [docs/03-testing/02-test-result/test-results.md](docs/03-testing/02-test-result/test-results.md)

**Projexa** คือระบบบริหารโครงการและเอกสารที่ขับเคลื่อนด้วย TOR (Terms of Reference) แนวคิดหลักคือเปลี่ยนแกนการทำงานของทีมจาก "เอกสารเป็นศูนย์กลาง" เป็น "ข้อมูลเป็นศูนย์กลาง" — ข้อมูลถูกกรอกเพียงครั้งเดียว และเอกสารส่งมอบทุกฉบับ (REQ, SDD, TSC, User Manual) คือ "มุมมอง" ที่ถูก generate ออกมาจากชุดข้อมูลเดียวกัน โดยเริ่มต้นจากการอัปโหลดไฟล์ TOR

ดูเอกสารออกแบบระบบฉบับเต็มได้ที่ [Projexa-System-Design-R1.md](Projexa-System-Design-R1.md)

## สถานะของ repo นี้

ส่วนออกแบบระบบ Projexa เต็มรูปแบบ (ตาม `Projexa-System-Design-R1.md`) ยังอยู่ในสถานะ **เอกสารวางแผน/ออกแบบเท่านั้น** — ยังไม่มีซอร์สโค้ดของระบบ Projexa จริง

**ข้อยกเว้น:** โฟลเดอร์ [`app/`](app/) มีซอร์สโค้ดจริงชุดแรก — เว็บ HTML/CSS/JS ธรรมดา (ไม่มี build step) ของ **โมดูล Screen Tracking (ขอบเขต NoSQL — งานส่งหลักสูตร)** ต่อ Firebase Firestore project จริงตรงจากเบราว์เซอร์ ดูขอบเขตเจาะจงของโมดูลนี้ได้ที่ [SCOPE.md](SCOPE.md) — **ไม่ใช่** โค้ดของระบบ Projexa จริงทั้งระบบ

## โครงสร้างโฟลเดอร์หลัก

| โฟลเดอร์/ไฟล์ | รายละเอียด |
| --- | --- |
| [`Projexa-System-Design-R1.md`](Projexa-System-Design-R1.md) | เอกสารออกแบบระบบ Projexa เต็มรูปแบบ (แนวคิด, data model, 26 หน้าจอ, สถาปัตยกรรม) |
| [`SCOPE.md`](SCOPE.md) | ขอบเขตงานส่งหลักสูตร (NoSQL module) — สิ่งที่ทำจริงใน `app/` |
| [`ACL.md`](ACL.md) | ตารางสิทธิ์ตามบทบาท (การกระทำ × บทบาท) ระดับการออกแบบ |
| [`docs/`](docs/index.md) | Obsidian vault เก็บเอกสารทั้งหมดตามลำดับ workflow (requirements → design → testing → retrospectives, คู่ขนานด้วย log, ของเก่าเก็บที่ archived) |
| [`app/`](app/) | ซอร์สโค้ดจริงของโมดูล Screen Tracking (Firebase) |
| `Projexa.html` | ไฟล์ต้นทางอ้างอิงสี/ฟอนต์/รูปทรงของ Design System เท่านั้น ไม่ใช่ซอร์สโค้ดหรือเอกสาร |

## โมดูล Screen Tracking (`app/`) — วิธีรันแอป

1. เปิดใช้งาน Email/Password provider ใน Firebase Console → Authentication → Sign-in method
2. คัดลอก `app/js/firebase-config.example.js` เป็น `app/js/firebase-config.js` แล้วใส่ค่าจริงจาก Firebase Console ของโปรเจกต์
3. ติดตั้งและรัน:
   ```bash
   cd app
   npm install
   npx serve -l 3000 .
   ```
4. เปิด `http://localhost:3000/login.html` (ต้องเสิร์ฟผ่าน http เพราะใช้ ES module — เปิดไฟล์ตรงๆ ไม่ได้)
5. สมัครสมาชิกผ่าน `signup.html` (สร้างทั้ง Firebase Auth account และเอกสารใน collection `users` ให้อัตโนมัติ)
6. ใส่ข้อมูลตัวอย่างขึ้น Firestore ครั้งแรกผ่าน `app/seed.html` — ต้องสมัครสมาชิกผู้ใช้ตัวอย่างให้ครบผ่าน `signup.html` ก่อน เพราะ seed จะจับคู่ชื่อผู้รับผิดชอบกับ `user_id` จริงจากบัญชีที่สมัครไว้

ไม่มี lint/test suite สำหรับ `app/` ในตอนนี้

## ขอบเขตของโมดูล Screen Tracking

- **4 หน้าจอในสโคป:** ทะเบียนหน้าจอ, รายละเอียดหน้าจอ (create/edit), มอบหมายผู้รับผิดชอบ, บันทึกความก้าวหน้า
- **3 สถานะ:** `NotStarted`, `Analysis`, `Design`
- **5 บทบาท:** PM, BA, SA, DEV, IMP — ดูสิทธิ์แบบละเอียดที่ [ACL.md](ACL.md)

รายละเอียดขอบเขตเต็มและสิ่งที่ตัดออกจากสโคปดูที่ [SCOPE.md](SCOPE.md)

## ข้อควรระวังเรื่อง credential

ห้ามใส่คีย์ลับ (service account key, API key ของบริการอื่น, token, password) ลงไฟล์ใดๆ ที่จะ commit/push เข้า repo นี้เด็ดขาด

`app/js/firebase-config.js` (มีค่า Firebase config จริงของโปรเจกต์) อยู่ใน `.gitignore` แล้ว จะไม่ถูก commit/push — ไฟล์ที่ track ใน git คือ `app/js/firebase-config.example.js` (ค่าเป็น placeholder ทั้งหมด) เท่านั้น หากต้องการปิดความเสี่ยงจากค่า `apiKey` ที่เคยหลุดไปก่อนหน้านี้อย่างสมบูรณ์ ต้อง rotate/regenerate ค่านั้นที่ Firebase Console เอง

## เอกสารเพิ่มเติม

- [docs/index.md](docs/index.md) — ศูนย์รวมเอกสารทั้งหมดของโปรเจกต์
- [Projexa-System-Design-R1.md](Projexa-System-Design-R1.md) — เอกสารออกแบบระบบเต็มรูปแบบ
- [SCOPE.md](SCOPE.md) — ขอบเขตงานส่งหลักสูตร (NoSQL module)
- [ACL.md](ACL.md) — ตารางสิทธิ์ตามบทบาท
