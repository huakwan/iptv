# Performance Audit — Web Player (`web/tv`)

ตรวจสอบ: 2026-10-26
ขอบเขต: `web/tv/` (app.js, index.html, styles.css) + ไฟล์ที่ deploy จริง (`channels.json` ~9 KB, `epg.json` ~60 KB จาก `.gh-pages/tv/`)
ไม่ได้ตรวจ: `scripts/WebGenerator.ts` ฝั่ง build, CI (`update.yml`), GitHub Pages headers

---

## สรุป

โครงสร้างโดยรวมดี: hls.js เปิด `enableWorker` + `progressive`, buffer 30s/60s เหมาะกับ live,
โหลดก่อน (preconnect) CDN และโฮสต์สตรีมครบ, โลโก้ใช้ `loading="lazy"`,
audio graph (WebAudio gain) สร้างแบบ deferred เฉพาะช่องที่กำหนด `gain`,
จุดเสียใหญ่สุดคือ **ของหนักที่โหลดไม่จำเป็นตอนเปิดหน้าแรก** — hls.js (~500 KB), font CSS render-blocking,
และ `epg.json` 60 KB โหลดพร้อมเปิดหน้าแม้จะไม่ได้กด EPG

---

## P1 — เปิดหน้าครั้งแรก (ผลต่างมากในเครือข่ายมือถือ)

### 1. hls.js โหลดตั้งแต่เปิดหน้า แม้ไม่ได้เปิด player

- **src:** `web/tv/index.html:69`
  ```html
  <script src="https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js" defer></script>
  ```
- **ปัญหา:** ผู้ใช้ส่วนใหญ่ต้องแค่ "ดูรายการช่อง" — ตัวเล่นค่อยใช้ hls.js, ระบบ lazy-load ผ่าน `loadHlsScript()`
  (`app.js:403-415`) พร้อม fallback ครบอยู่แล้ว
- **ผลเสีย:** เปลือง ~500 KB (gzip ~150 KB) แย่ง bandwidth ช่วงแรกกับ `channels.json`
- **แก้:** ลบ static tag ออก ให้ lazy-load เฉพาะเมื่อกดเปิดช่อง

### 2. Google Fonts stylesheet render-blocking

- **src:** `web/tv/index.html:26-29`
  ```html
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;600;700&display=swap" rel="stylesheet" />
  ```
- **ปัญหา:** `<link rel="stylesheet">` ใน `<head>` ทำให้ first paint หน่วงจนกว่าไฟล์ CSS จะโหลดเสร็จ
- **ผลเสีย:** บนเน็ตช้า first paint หน่วงชัดเจน
- **แก้:** ใช้ pattern preload + onload (เสียภาพ FOUT เล็กน้อย — ภาษาไทยแม่สายตาบน `display=swap` อยู่แล้ว)
  ```html
  <link rel="preload" as="style" href="..." />
  <link rel="stylesheet" href="..." media="print" onload="this.media='all'" />
  ```
- **หมายเหตุ:** URL มี `display=swap` อยู่แล้ว — ปัญหาคือ stylesheet เอง เปิดมา fetch ก่อน render

### 3. โหลด hls.js ซ้ำสองครั้งเมื่อผู้ใช้กดเร็ว

- **src:** `app.js` เป็น sync script (`index.html:310`) → รันก่อน hls.js ที่ `defer`
  ถ้าผู้ใช้กดช่องตอน CDN โหลดยังไม่เสร็จ `loadHlsScript()` จะ append `<script>` tag ที่สอง →
  ดาวน์โหลด 2 ชุด + `window.Hls` ถูกเขียนทับ (โหลดซ้ำเท่าที่ cache ช่วยได้)
- **แก้ (เลือกอย่างใดอย่างหนึ่ง):**
  - ทำให้ `app.js` เป็น `defer` ด้วย → ลำดับรันถูกต้องเสมอ (แนะนำ) หรือ
  - ให้ `loadHlsScript()` เก็บ promise แล้วเรียกซ้ำคืนตัวเดิม

> **รวม 1 + 3:** อย่าตัด static tag อย่างเดียวถ้ายังไม่แก้ข้อ 3 — lazy-load เองมีโอกาสโหลดซ้ำ
> ตอนกดเร็วกว่าแบบเดิม ทำคู่กันจึงคุ้ม

---

## P2 — Runtime (การใช้งานทุกวัน)

### 4. `epg.json` โหลดพร้อมเปิดหน้า ทั้งที่ใช้เมื่อกดปุ่ม EPG

- **src:** `loadEpg()` เรียกใน init (`app.js:1273`)
- **ปัญหา:** ผู้ใช้ไม่กด EPG → ไม่เคยใช้, แต่จ่าย bandwidth + parse 60 KB บนเครื่องเก่า
- **แก้:** lazy — `fetch('epg.json')` เมื่อกด `epgBtn` ครั้งแรก (ตอน popup แรกเท่านั้น).
  โค้ดราว 10 บรรทัด.

### 5. togglePin วาด grid ใหม่ทั้งหมด

- **src:** `togglePin()` → `renderGrid()` (`app.js:142-144`)
- **ปัญหา:** สร้างการ์ดใหม่ทั้งชุด (~30 การ์ด × 6 listeners/ตัว) ทุกครั้งปักหมุดผ่าน long-press —
  DOM churn ทั้งกริด เห็นตอนเครื่องช้า
- **แก้:** toggle class + ย้าย node ตัวการ์ดเดียว, หรือปล่อยไว้ได้ถ้าจำนวนช่องน้อย — ต่ำ

### 6. `decodeEntities` สร้าง `DOMParser` สองอินสตันซ์ต่อแถว EPG

- **src:** `buildEpgRow()` `app.js:808-817` (title + desc = 2 ครั้ง/แถว) ต่อช่องหนึ่งมีรอบละ ~100 แถว
- **ปัญหา:** jank ตอนเปิด popup ครั้งแรกบนเครื่องสเปกต่ำ
- **แก้:** parse ครั้งเดียวแล้วใช้ `doc.body.textContent` ต่อค่า หรือใช้ trick `textarea.textContent = value` ตอนอ่าน

---

## P3 — ระบบสตรีม (ตรวจแล้ว OK / ไม่แนะให้แตะ)

- Buffer: `maxBufferLength: 30`, `maxMaxBufferLength: 60`, `backBufferLength: 30` (`app.js:625-627`) — เหมาะกับ live, ไม่เปลือง RAM
- `enableWorker: true` + `progressive: true` (`app.js:635-636`) — ตั้งถูก
- audio graph สร้างเมื่อ `channelGain !== 1` เท่านั้น (`app.js:617-621`) — ตั้งถูก
- preconnect/dns-prefetch ไปที่ CDN + โฮสต์สตรีมครบ (`index.html:14-25`)
- animation `loader-spin` / `debug-res-beat` (`styles.css:259,557`) — infinite แต่เป็น element เล็ก, ต่ำ
- `img.loading="lazy"` + `referrerPolicy="no-referrer"` (`app.js:965-967`)
- auto-quality (2-level blob master + `hls.nextLevel`) — เทียบผ่าน `FRAG_LOADED` เป็นครั้งคราวเท่านั้น

## สิ่งที่ตรวจแล้ว "คุ้มแล้ว" — ไม่ต้องแก้

- `channels.json` 9 KB — ต้องโหลดเพื่อเรียงช่องจริง
- scrollIntoView ตอนเปิด popup `epgList` (`app.js:853-855`) — ใช้ครั้งเดียวตอนเปิด popup
- `history.pushState` — ไม่มีงานหนัก

---

## ลำดับการแก้ที่แนะนำ (ผลต่อบรรทัดโค้ดสูงสุด)

1. **#1 + #3** — lazy hls.js + ป้องกันโหลดซ้ำ → ลด payload เปิดหน้า ~500 KB, โค้ดราว 5 บรรทัด
2. **#4** — defer `epg.json` → ลดอีก 60 KB, ~10 บรรทัด
3. **#2** — font non-blocking → first paint เร็วขึ้นชัด, ~4 บรรทัด
4. **#5 + #6** — ลำดับสองเมื่อว่าง

## วัดผล (ก่อน/หลัง)

- Lighthouse (Mobile, throttled) กับ `index.html` version ที่ deploy — ดู FCP, LCP, Total Blocking Time
- วัด payload: Network tab หน้า index เทียบก่อน/หลัง ตัด hls.js + defer epg.json ออก
- Runtime: เปิด popup EPG + toggle pin บนเครื่องช้า (CPU 4x throttling) เทียบ long task ผ่าน Performance panel
