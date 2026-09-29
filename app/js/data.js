// ─────────────────────────────────────────────────────────────
// js/data.js — ข้อมูลตัวอย่างสำหรับ seed ขึ้น Firestore ครั้งเดียว (js/seed.js)
//
// โครงสร้าง/ชื่อ field ตรงกับ spec.md §2:
//   collection screens (โฟลเดอร์หลัก) — โฟลเดอร์ประกอบ screenTypes/users —
//   subcollection screens/{id}/statusHistory — embedded array assignees[]
//
// หมายเหตุ (หลังเพิ่มระบบล็อกอิน): users ไม่ได้ถูก seed ตรงๆ อีกต่อไป —
// ผู้ใช้ต้องสมัครสมาชิกเองผ่าน signup.html (ดูรายชื่อ/อีเมลอ้างอิงด้านล่าง
// ที่ใช้แสดงบน seed.html) เพราะ document id ของ users ตอนนี้เป็น Firestore
// auto-generated id (ผูก uid ไม่ได้ล่วงหน้า) — ส่วน assignees[]/statusHistory
// ในข้อมูลตัวอย่างด้านล่างจึงอ้างอิงคนด้วย "ชื่อ" (user_name/changed_by_name/
// assigned_by_name) แทน user_id ตรงๆ แล้วให้ js/seed.js ค้นหา user_id จริง
// จาก Firestore collection users (ที่มาจากการสมัครสมาชิก) มาแทนที่ตอน seed
// ─────────────────────────────────────────────────────────────

export const SCREEN_TYPES = [
  { code: "PROCESS", label: "Process", is_active: true },
  { code: "INQUIRY", label: "Inquiry", is_active: true },
  { code: "REPORTUI", label: "Report UI", is_active: true },
  { code: "SERVICE", label: "Service", is_active: true },
  { code: "REPORT", label: "Report", is_active: true }
];

export const SAMPLE_SCREENS = [
  {
    code: "SCR-101",
    name: "ค้นหาและแสดงรายการใบลา",
    description: "หน้าจอสำหรับพนักงานค้นหาและดูรายการใบลาของตนเอง กรองตามวันที่ สถานะ",
    type_id: "INQUIRY",
    assignees: [
      { user_name: "สมชาย ใจดี", role: "Dev", assigned_by_name: "ปรีชา มั่นคง", assigned_at: "2026-08-20T09:00:00.000Z" }
    ],
    origin_label: "ManualEntry",
    ai_confidence: null,
    is_suggested: false,
    current_status: "Analysis",
    statusHistory: [
      { changed_by_name: "สมชาย ใจดี", changed_at: "2026-08-21T09:00:00.000Z", old_status: "NotStarted", new_status: "Analysis", reason: null, note: null }
    ]
  },
  {
    code: "SCR-102",
    name: "อนุมัติใบลา",
    description: "หน้าจอสำหรับหัวหน้างานอนุมัติ/ไม่อนุมัติใบลาที่พนักงานยื่น ดูประวัติอนุมัติ",
    type_id: "PROCESS",
    assignees: [
      { user_name: "สมหญิง วิเคราะห์", role: "Dev", assigned_by_name: "ปรีชา มั่นคง", assigned_at: "2026-08-18T10:00:00.000Z" },
      { user_name: "วีระ ตรวจสอบ", role: "Tester", assigned_by_name: "ปรีชา มั่นคง", assigned_at: "2026-08-18T10:00:00.000Z" }
    ],
    origin_label: "HumanConfirmed",
    ai_confidence: 0.91,
    is_suggested: false,
    current_status: "Design",
    statusHistory: [
      { changed_by_name: "สมหญิง วิเคราะห์", changed_at: "2026-08-19T09:00:00.000Z", old_status: "NotStarted", new_status: "Analysis", reason: null, note: null },
      { changed_by_name: "สมหญิง วิเคราะห์", changed_at: "2026-08-24T09:00:00.000Z", old_status: "Analysis", new_status: "Design", reason: null, note: null }
    ]
  },
  {
    code: "SCR-103",
    name: "รายงานสรุปวันลาสะสม",
    description: "รายงานสรุปจำนวนวันลาคงเหลือของพนักงานแต่ละคน พร้อมตัวกรอง",
    type_id: "REPORT",
    assignees: [],
    origin_label: "ManualEntry",
    ai_confidence: null,
    is_suggested: false,
    current_status: "NotStarted",
    statusHistory: []
  },
  {
    code: "SCR-104",
    name: "บริการแจ้งเตือนวันลาใกล้หมดอายุ",
    description: "บริการเบื้องหลังที่ส่งการแจ้งเตือนอัตโนมัติเมื่อวันลาใกล้หมดอายุ ส่งผ่าน Email/SMS",
    type_id: "SERVICE",
    assignees: [
      { user_name: "สมชาย ใจดี", role: "Dev", assigned_by_name: "ปรีชา มั่นคง", assigned_at: "2026-08-22T09:00:00.000Z" }
    ],
    origin_label: "AIGenerated",
    ai_confidence: 0.78,
    is_suggested: true,
    current_status: "Analysis",
    statusHistory: [
      { changed_by_name: "สมชาย ใจดี", changed_at: "2026-08-23T09:00:00.000Z", old_status: "NotStarted", new_status: "Analysis", reason: null, note: null }
    ]
  },
  {
    code: "SCR-105",
    name: "แดชบอร์ดสรุปการลาระดับทีม",
    description: "หน้าจอสรุปภาพรวมการลาของทีมสำหรับหัวหน้างาน ทำความเข้าใจการลาครั้งใหญ่",
    type_id: "REPORTUI",
    assignees: [
      { user_name: "ปรีชา มั่นคง", role: "Dev", assigned_by_name: "ปรีชา มั่นคง", assigned_at: "2026-08-15T09:00:00.000Z" },
      { user_name: "พิมพ์ใจ ดีงาม", role: "Tester", assigned_by_name: "ปรีชา มั่นคง", assigned_at: "2026-08-15T09:00:00.000Z" }
    ],
    origin_label: "HumanConfirmed",
    ai_confidence: 0.85,
    is_suggested: false,
    current_status: "Design",
    statusHistory: [
      { changed_by_name: "ปรีชา มั่นคง", changed_at: "2026-08-16T09:00:00.000Z", old_status: "NotStarted", new_status: "Analysis", reason: null, note: null },
      { changed_by_name: "ปรีชา มั่นคง", changed_at: "2026-08-20T09:00:00.000Z", old_status: "Analysis", new_status: "Design", reason: null, note: null }
    ]
  },
  {
    code: "SCR-106",
    name: "นำเข้าข้อมูลพนักงานจากไฟล์ Excel",
    description: "กระบวนการนำเข้าข้อมูลพนักงานชุดใหญ่จากไฟล์ Excel เข้าสู่ระบบ ตรวจสอบความถูกต้อง",
    type_id: "PROCESS",
    assignees: [],
    origin_label: "ManualEntry",
    ai_confidence: null,
    is_suggested: false,
    current_status: "NotStarted",
    statusHistory: []
  },
  {
    code: "SCR-107",
    name: "รายงานสรุปอัตราการปลอดภัยงาน",
    description: "รายงานทางสถิติของงานที่มีความเสี่ยงและแนวทางป้องกัน สำหรับผู้บริหาร",
    type_id: "REPORT",
    assignees: [
      { user_name: "สมหญิง วิเคราะห์", role: "Dev", assigned_by_name: "ปรีชา มั่นคง", assigned_at: "2026-08-25T14:30:00.000Z" }
    ],
    origin_label: "ManualEntry",
    ai_confidence: null,
    is_suggested: false,
    current_status: "Analysis",
    statusHistory: [
      { changed_by_name: "สมหญิง วิเคราะห์", changed_at: "2026-08-26T10:00:00.000Z", old_status: "NotStarted", new_status: "Analysis", reason: null, note: null }
    ]
  },
  {
    code: "SCR-108",
    name: "ค้นหาข้อมูลการเบิกจ่ายวัสดุ",
    description: "หน้าจอสำหรับค้นหาประวัติการเบิกจ่ายวัสดุสำนักงาน กรองตามประเภท วันที่ ผู้เบิก",
    type_id: "INQUIRY",
    assignees: [
      { user_name: "วีระ ตรวจสอบ", role: "Dev", assigned_by_name: "ปรีชา มั่นคง", assigned_at: "2026-08-27T11:00:00.000Z" }
    ],
    origin_label: "AIGenerated",
    ai_confidence: 0.82,
    is_suggested: true,
    current_status: "NotStarted",
    statusHistory: []
  }
];

// สำหรับความเข้ากันได้กับโค้ดเดิม window.SEED_DATA (ถ้ายัง)
window.SEED_DATA = {
  users: [
    { name: "สมชาย ใจดี", email: "somchai@example.com" },
    { name: "สมหญิง วิเคราะห์", email: "somying@example.com" },
    { name: "วีระ ตรวจสอบ", email: "weera@example.com" },
    { name: "ปรีชา มั่นคง", email: "preecha@example.com" },
    { name: "พิมพ์ใจ ดีงาม", email: "pimjai@example.com" }
  ],
  screenTypes: SCREEN_TYPES.map(t => ({ ...t, id: t.code })),
  screens: SAMPLE_SCREENS.map(s => ({
    ...s,
    type: { type_id: s.type_id, label: SCREEN_TYPES.find(t => t.code === s.type_id)?.label },
    is_deleted: false
  }))
};
