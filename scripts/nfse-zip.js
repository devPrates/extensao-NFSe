(() => {
  function concat(parts) {
    let len = 0;
    for (const p of parts) len += p.length;
    const out = new Uint8Array(len);
    let off = 0;
    for (const p of parts) {
      out.set(p, off);
      off += p.length;
    }
    return out;
  }
  function u16(n) {
    const a = new Uint8Array(2);
    new DataView(a.buffer).setUint16(0, n, true);
    return a;
  }
  function u32(n) {
    const a = new Uint8Array(4);
    new DataView(a.buffer).setUint32(0, n, true);
    return a;
  }
  function strBytes(s) {
    return new TextEncoder().encode(s);
  }
  function dosTime(date = new Date()) {
    const h = date.getHours();
    const m = date.getMinutes();
    const s = Math.floor(date.getSeconds() / 2);
    return ((h & 0x1f) << 11) | ((m & 0x3f) << 5) | (s & 0x1f);
  }
  function dosDate(date = new Date()) {
    const y = date.getFullYear() - 1980;
    const m = date.getMonth() + 1;
    const d = date.getDate();
    return ((y & 0x7f) << 9) | ((m & 0x0f) << 5) | (d & 0x1f);
  }
  function crc32(buf) {
    let t = crc32.table;
    if (!t) {
      t = new Uint32Array(256);
      for (let i = 0; i < 256; i++) {
        let c = i;
        for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        t[i] = c >>> 0;
      }
      crc32.table = t;
    }
    let c = 0 ^ -1;
    for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ t[(c ^ buf[i]) & 0xFF];
    return (c ^ -1) >>> 0;
  }
  function createZipStore(entries) {
    const chunks = [];
    const central = [];
    let offset = 0;
    for (const e of entries) {
      const name = e.name;
      const nameBytes = strBytes(name);
      const data = e.data;
      const crc = crc32(data);
      const size = data.length >>> 0;
      const dt = dosTime();
      const dd = dosDate();
      const localParts = [];
      localParts.push(u32(0x04034b50));
      localParts.push(u16(20));
      localParts.push(u16(0));
      localParts.push(u16(0));
      localParts.push(u16(dt));
      localParts.push(u16(dd));
      localParts.push(u32(crc));
      localParts.push(u32(size));
      localParts.push(u32(size));
      localParts.push(u16(nameBytes.length));
      localParts.push(u16(0));
      localParts.push(nameBytes);
      localParts.push(data);
      const localBlob = concat(localParts);
      chunks.push(localBlob);

      const centralParts = [];
      centralParts.push(u32(0x02014b50));
      centralParts.push(u16(20));
      centralParts.push(u16(20));
      centralParts.push(u16(0));
      centralParts.push(u16(0));
      centralParts.push(u16(dt));
      centralParts.push(u16(dd));
      centralParts.push(u32(crc));
      centralParts.push(u32(size));
      centralParts.push(u32(size));
      centralParts.push(u16(nameBytes.length));
      centralParts.push(u16(0));
      centralParts.push(u16(0));
      centralParts.push(u16(0));
      centralParts.push(u16(0));
      centralParts.push(u32(0));
      centralParts.push(u32(offset));
      centralParts.push(nameBytes);
      const centralBlob = concat(centralParts);
      central.push(centralBlob);

      offset += localBlob.length;
    }
    const centralDir = concat(central);
    const endParts = [];
    endParts.push(u32(0x06054b50));
    endParts.push(u16(0));
    endParts.push(u16(0));
    endParts.push(u16(entries.length));
    endParts.push(u16(entries.length));
    endParts.push(u32(centralDir.length));
    endParts.push(u32(chunks.reduce((a, c) => a + c.length, 0)));
    endParts.push(u16(0));
    const endBlob = concat(endParts);
    const out = concat([...chunks, centralDir, endBlob]);
    return new Blob([out], { type: "application/zip" });
  }
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  window.NFSE = window.NFSE || {};
  window.NFSE.zip = { createZipStore, downloadBlob };
})();
