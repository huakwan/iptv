# Thai IPTV

เพลย์ลิสต์ช่องโทรทัศน์ไทยสำหรับเล่นผ่านแอพ **APTV** บน iPhone/iPad/Apple TV และ **Apple CarPlay**

## ที่มา

โปรเจกต์นี้ fork มาจาก [iptv-org/iptv](https://github.com/iptv-org/iptv) ซึ่งรวบรวมลิงก์สตรีมสาธารณะทั่วโลก แต่เวอร์ชันนี้ **ตัดให้เหลือเฉพาะช่องไทยจำนวนหนึ่ง** ที่ทดสอบแล้วว่าเล่นได้ (ปัจจุบัน 20 ช่อง) โดยแก้ไขจากรายการใน [`streams/th.json`](streams/th.json) เท่านั้น ไม่ได้ตั้งใจทำเป็นคลังช่องครบทุกช่องเหมือนต้นทาง

## การใช้งานกับ APTV (Apple CarPlay)

1. เปิดแอพ APTV แล้วไปที่เมนูเพิ่มเพลย์ลิสต์ (Playlist / M3U)
2. วางลิงก์นี้:

   ```
   https://huakwan.github.io/iptv/countries/th.m3u
   ```

   ใช้ลิงก์ `https://huakwan.github.io/iptv/index.m3u` ก็ได้ ผลลัพธ์เหมือนกัน (มีช่องไทยชุดเดียวกัน)
3. บันทึกแล้วรอ APTV ดึงข้อมูลช่อง
4. เชื่อมต่อกับระบบ Apple CarPlay แล้วเปิด APTV จะเห็นรายการช่องในหน้ารถ

### EPG (ผังรายการ)

เพลย์ลิสต์ฝัง URL ของ EPG ไว้ในแท็ก `x-tvg-url` แล้ว APTV จะดึงผังรายการให้อัตโนมัติเมื่อโหลดเพลย์ลิสต์ ไม่ต้องตั้งค่าเพิ่ม

ถ้าต้องการใส่เองด้วยมือ ใช้ลิงก์:

```
https://huakwan.github.io/iptv/guide.xml
```

ข้อมูล EPG สร้างจากสองแหล่งคือ `gigatv.3bbtv.co.th` และ `tv.trueid.net` ถ้าแหล่งใดล่ม ช่องของแหล่งนั้นจะไม่มีผังในรอบนั้น แต่ยังเล่นสตรีมได้ตามปกติ

## ช่องที่มีในเพลย์ลิสต์

| หมวด | ช่อง |
| --- | --- |
| General | 3HD, Channel 5, Channel 7, Channel 8, MCOT HD, One 31, Rama Channel |
| Entertainment | Workpoint TV, MONO 29, True4U, Amarin TV, GMM 25, Thai Chaiyo, Cool Channel, Good Idea TV |
| News | Thai PBS, Thairath TV, Nation TV, Thai Parliament TV |
| Sports | T Sports 7 |

หมายเหตุ: ลิงก์สตรีม IPTV ตายบ่อย หากช่องใดเล่นไม่ได้ ให้แจ้งผ่าน issue. ช่อง Good Idea TV ออกอากาศไม่ครบ 24 ชั่วโมง (ติดป้าย `[Not 24/7]`) และใช้สตรีมผ่าน HTTP (พอร์ต 1935) เครื่องเล่นบางตัวโดยเฉพาะบน iOS/APTV อาจไม่เปิดให้

## สำหรับนักพัฒนา

ส่วนนี้รวบไว้สั้น ๆ สำหรับผู้ที่ต้องการแก้ไขเพลย์ลิสต์เอง

- แก้ช่องได้ที่ [`streams/th.json`](streams/th.json) ไฟล์เดียว (ไฟล์ `.m3u` ใน `streams/` ถูกสร้างใหม่และไม่เก็บใน git)
- เมื่อเพิ่ม/ลบช่อง ต้องแก้ [`.github/epg/channels.xml`](.github/epg/channels.xml) ให้ตรงกันด้วย ไม่งั้นช่องจะไม่มีผังรายการ
- คำสั่งหลัก:

  ```sh
  npm install              # ติดตั้ง dependencies
  npm run playlist:generate # สร้าง .m3u แล้วอัปเดตเพลย์ลิสต์สาธารณะ
  npm run lint             # ตรวจ ESLint
  make deploy              # สั่งรัน workflow แล้ว deploy ขึ้น GitHub Pages
  ```

- การ deploy เป็นแบบmanual: workflow [update.yml](.github/workflows/update.yml) ทำงานตาม schedule รายวันและเมื่อสั่ง `workflow_dispatch` เท่านั้น ไม่รันตอน push

## Legal

รีโปนี้ไม่ได้เก็บไฟล์วิดีโอใด ๆ มีเพียงลิงก์ไปยังสตรีมที่เผยแพร่ต่อสาธารณะอยู่แล้ว หากลิงก์ใดละเมิดลิขสิทธิ์ สามารถแจ้งเพื่อลบได้ผ่าน issue แต่ผู้ดูแลไม่สามารถควบคุมเนื้อหาปลายทางได้ และการลบลิงก์ออกจากเพลย์ลิสต์ไม่ได้ลบเนื้อหาออกจากเว็บต้นทาง

## License

[![CC0](https://mirrors.creativecommons.org/presskit/buttons/88x31/svg/cc-zero.svg)](LICENSE)

โปรเจกต์นี้ต่อยอดจาก [iptv-org/iptv](https://github.com/iptv-org/iptv) ซึ่งเผยแพร่ภายใต้ [Unlicense](https://unlicense.org/)
