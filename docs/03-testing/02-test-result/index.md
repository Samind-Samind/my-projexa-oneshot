# 02 - Test Result

เก็บ **ผลการทดสอบจริง** ตาม test case ที่วางไว้ใน [[../01-test-plan/index|01-test-plan]] เช่น

- ผล pass/fail ของแต่ละ test case
- บั๊ก (bug) ที่พบ พร้อมรายละเอียดและความรุนแรง
- สถานะการแก้ไขบั๊ก

ผลลัพธ์และปัญหาที่พบในโฟลเดอร์นี้จะถูกนำไปสรุปบทเรียนต่อใน [[../../04-retrospectives/index|04-retrospectives]]

## รายงานผล

- [[test-results]] — ผลรัน Playwright smoke test อัตโนมัติ (2026-09-30)
- [[20260930-spec-gap-retest]] — รันซ้ำ 4 เคส SPEC-GAP ตามเกณฑ์ใหม่ + regression SCR-016 บน localhost และเว็บจริง (2026-09-30)
- [[20260930-e2e-spec-rerun]] — รันชุด E2E 42 เคสใหม่ทั้งชุด โดย sub-agent `tester` (2026-09-30)
- [[20260929-e2e-spec-result]] — ผลทดสอบ E2E ตาม spec.md โดย sub-agent `tester`
