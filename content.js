const SELECTORS = {
  table: "table.table.table-striped",
  paginationLink: 'a[href*="Notas/Emitidas?pg="]',
  competenciaCell: "td.td-competencia",
  xmlLink: 'a[href*="/EmissorNacional/Notas/Download/NFSe/"]'
};

function getCandidateTables() {
  const specific = Array.from(document.querySelectorAll(SELECTORS.table));
  if (specific.length) return specific;
  return Array.from(document.querySelectorAll("table"));
}
function findTargetTable() {
  const tables = getCandidateTables();
  if (tables.length === 0) return null;
  let best = null;
  let bestScore = -1;
  for (const t of tables) {
    const rows = (t.querySelectorAll("tbody tr").length || t.querySelectorAll("tr").length);
    const hasHead = !!t.querySelector("thead");
    const txt = (t.innerText || "").toLowerCase();
    const score = rows + (hasHead ? 5 : 0) + ((txt.includes("competencia") || txt.includes("competência")) ? 10 : 0);
    if (score > bestScore) { best = t; bestScore = score; }
  }
  return best;
}
function waitForTable(timeoutMs = 15000) {
  const start = Date.now();
  return new Promise((resolve) => {
    const check = () => {
      const el = findTargetTable();
      if (el) return resolve(el);
      if (Date.now() - start > timeoutMs) return resolve(null);
      requestAnimationFrame(check);
    };
    check();
  });
}

function injectToolbar(target) {
  const container = document.createElement("div");
  container.id = "nfse-ext-toolbar";
  container.style.display = "flex";
  container.style.gap = "8px";
  container.style.margin = "12px 0";
  container.style.alignItems = "center";

  const select = document.createElement("select");
  select.id = "nfse-ext-month";
  select.style.padding = "6px 8px";
  const optAll = document.createElement("option");
  optAll.value = "";
  optAll.textContent = "Todos os meses";
  select.appendChild(optAll);
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, "0");
    const opt = document.createElement("option");
    opt.value = mm;
    opt.textContent = `Mês ${mm}`;
    select.appendChild(opt);
  }

  const yearSelect = document.createElement("select");
  yearSelect.id = "nfse-ext-year";
  yearSelect.style.padding = "6px 8px";
  const optYAll = document.createElement("option");
  optYAll.value = "";
  optYAll.textContent = "Todos os anos";
  yearSelect.appendChild(optYAll);
  const currentYear = new Date().getFullYear();
  for (let y = 0; y < 6; y++) {
    const yy = String(currentYear - y);
    const opt = document.createElement("option");
    opt.value = yy;
    opt.textContent = yy;
    yearSelect.appendChild(opt);
  }

  const button = document.createElement("button");
  button.id = "nfse-ext-download-all";
  button.textContent = "Baixar Todos";
  button.style.padding = "6px 12px";
  button.style.cursor = "pointer";
  button.disabled = true;

  const zipButton = document.createElement("button");
  zipButton.id = "nfse-ext-zip-all";
  zipButton.textContent = "Gerar .zip";
  zipButton.style.padding = "6px 12px";
  zipButton.style.cursor = "pointer";

  const status = document.createElement("span");
  status.id = "nfse-ext-status";
  status.style.marginLeft = "8px";
  status.style.fontSize = "12px";

  ensureStyles();
  const spinner = document.createElement("span");
  spinner.id = "nfse-ext-spinner";
  spinner.className = "nfse-ext-spinner";
  spinner.style.display = "none";
  spinner.style.marginLeft = "0";

  const statusProcess = document.createElement("span");
  statusProcess.id = "nfse-ext-status-process";
  statusProcess.style.marginLeft = "0";
  statusProcess.style.fontSize = "12px";

  const statusPercent = document.createElement("span");
  statusPercent.id = "nfse-ext-status-percent";
  statusPercent.style.marginLeft = "4px";
  statusPercent.style.fontSize = "12px";

  const statusGroup = document.createElement("span");
  statusGroup.id = "nfse-ext-status-group";
  statusGroup.style.display = "inline-flex";
  statusGroup.style.alignItems = "center";
  statusGroup.style.gap = "4px";
  statusGroup.appendChild(spinner);
  statusGroup.appendChild(statusProcess);

  const progress = document.createElement("progress");
  progress.id = "nfse-ext-progress";
  progress.max = 100;
  progress.value = 0;
  progress.style.width = "120px";
  progress.style.marginLeft = "2px";
  progress.style.display = "none";

  container.appendChild(select);
  container.appendChild(yearSelect);
  container.appendChild(button);
  container.appendChild(zipButton);
  container.appendChild(statusGroup);
  container.appendChild(statusPercent);
  container.appendChild(progress);

  target.parentNode.insertBefore(container, target);
  return { select, yearSelect, button, zipButton, statusProcess, statusPercent, spinner, progress };
}

function normalize(s) {
  return (s || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function ensureStyles() {
  if (document.getElementById("nfse-ext-style")) return;
  const style = document.createElement("style");
  style.id = "nfse-ext-style";
  style.textContent = `
    .nfse-ext-spinner {
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 2px solid #bbb;
      border-top-color: #333;
      border-radius: 50%;
      animation: nfse-ext-spin 0.8s linear infinite;
      margin-left: 6px;
      vertical-align: middle;
    }
    @keyframes nfse-ext-spin { to { transform: rotate(360deg); } }
  `;
  document.head.appendChild(style);
}

function findCompetenciaColumnIndex(tableEl) {
  const thead = tableEl.querySelector("thead");
  const headerRow =
    (thead && thead.querySelector("tr")) || tableEl.querySelector("tr");
  const headers = headerRow ? Array.from(headerRow.querySelectorAll("th, td")) : [];
  for (let i = 0; i < headers.length; i++) {
    const txt = normalize(headers[i].innerText || "");
    if (txt.includes("competencia") || txt.includes("competência")) return i;
  }
  const bodyRows = Array.from(tableEl.querySelectorAll("tbody tr"));
  if (bodyRows.length > 0) {
    const first = bodyRows[0];
    const cells = Array.from(first.querySelectorAll("td"));
    for (let i = 0; i < cells.length; i++) {
      const mm = extractMonthFromCompetencia(cells[i].innerText || "");
      if (mm) return i;
    }
  }
  return -1;
}

function extractMonthFromCompetencia(text) {
  const t = (text || "").trim();
  const m1 = t.match(/(\d{2})[\/\-](\d{4})/);
  if (m1) {
    const mm = m1[1];
    const n = parseInt(mm, 10);
    if (Number.isFinite(n) && n >= 1 && n <= 12) return mm;
  }
  const m2 = t.match(/(\d{4})[\/\-](\d{2})/);
  if (m2) {
    const mm = m2[2];
    const n = parseInt(mm, 10);
    if (Number.isFinite(n) && n >= 1 && n <= 12) return mm;
  }
  return null;
}

function extractYearFromCompetencia(text) {
  const t = (text || "").trim();
  const m1 = t.match(/(\d{2})[\/\-](\d{4})/);
  if (m1) {
    return m1[2];
  }
  const m2 = t.match(/(\d{4})[\/\-](\d{2})/);
  if (m2) {
    return m2[1];
  }
  return null;
}

function rowMatchesMonth(tr, month, year, compIdx) {
  if (!month) return true;
  const cell = tr.querySelector(SELECTORS.competenciaCell);
  if (cell) {
    const txt = cell.innerText || "";
    const mm = extractMonthFromCompetencia(txt);
    const yy = extractYearFromCompetencia(txt);
    if (mm && (!year || yy === year)) return mm === month;
  }
  if (compIdx >= 0) {
    const cells = Array.from(tr.querySelectorAll("td"));
    if (compIdx < cells.length) {
      const txt = cells[compIdx].innerText || "";
      const mm = extractMonthFromCompetencia(txt);
      const yy = extractYearFromCompetencia(txt);
      if (mm && (!year || yy === year)) return mm === month;
    }
  }
  return false;
}

function applyFilterToTable(tableEl, month, year) {
  const compIdx = findCompetenciaColumnIndex(tableEl);
  const rows = Array.from(tableEl.querySelectorAll("tbody tr"));
  let visible = 0;
  rows.forEach((tr) => {
    const match = rowMatchesMonth(tr, month, year, compIdx);
    tr.style.display = match ? "" : "none";
    if (match) visible++;
  });
  return visible;
}

function findXmlLinkInRow(tr) {
  const anchors = Array.from(tr.querySelectorAll(SELECTORS.xmlLink));
  for (const a of anchors) {
    const href = a.getAttribute("href") || "";
    if (!href) continue;
    return toAbsoluteUrl(href);
  }
  return null;
}

function toAbsoluteUrl(href) {
  try {
    const u = new URL(href, window.location.origin);
    return u.toString();
  } catch {
    return href;
  }
}

function collectXmlLinksFromTable(tableEl, month, year) {
  const compIdx = findCompetenciaColumnIndex(tableEl);
  const rows = Array.from(tableEl.querySelectorAll("tbody tr"));
  const urls = [];
  rows.forEach((tr) => {
    const match = rowMatchesMonth(tr, month, year, compIdx);
    if (!match) return;
    const url = findXmlLinkInRow(tr);
    if (url) urls.push(url);
  });
  return urls;
}

function getMaxPageFromDoc(doc) {
  const links = Array.from(doc.querySelectorAll(SELECTORS.paginationLink));
  const pages = links
    .map((a) => {
      try {
        const u = new URL(a.getAttribute("href"), window.location.origin);
        return parseInt(u.searchParams.get("pg") || "0", 10);
      } catch {
        return 0;
      }
    })
    .filter((n) => Number.isFinite(n) && n > 0);
  if (pages.length === 0) {
    const current = new URL(window.location.href);
    const n = parseInt(current.searchParams.get("pg") || "1", 10);
    return Number.isFinite(n) ? n : 1;
  }
  return Math.max(...pages);
}

async function fetchPageHtml(url) {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`Falha ao carregar página: ${res.status}`);
  return res.text();
}

function parseHtmlToDoc(html) {
  const parser = new DOMParser();
  return parser.parseFromString(html, "text/html");
}

function compareYearMonth(aYear, aMonth, bYear, bMonth) {
  const ay = parseInt(aYear || "0", 10);
  const by = parseInt(bYear || "0", 10);
  const am = parseInt(aMonth || "0", 10);
  const bm = parseInt(bMonth || "0", 10);
  if (ay !== by) return ay - by;
  return am - bm;
}

async function collectXmlLinksAcrossPages(month, year) {
  const currentUrl = new URL(window.location.href);
  const base = `${currentUrl.origin}/EmissorNacional/Notas/Emitidas`;
  const currentDoc = document;
  const maxPage = getMaxPageFromDoc(currentDoc);
  const urls = [];

  for (let pg = 1; pg <= maxPage; pg++) {
    const url = `${base}?pg=${pg}`;
    let doc;
    if (pg === parseInt(currentUrl.searchParams.get("pg") || "1", 10)) {
      doc = currentDoc;
    } else {
      const html = await fetchPageHtml(url);
      doc = parseHtmlToDoc(html);
    }
    const tableEl = doc.querySelector(SELECTORS.table) || doc.querySelector("table.table");
    if (!tableEl) continue;
    const pageUrls = collectXmlLinksFromTable(tableEl, month, year);
    urls.push(...pageUrls);
    await new Promise((r) => setTimeout(r, 150));
    if (year) {
      const rows = Array.from(tableEl.querySelectorAll("tbody tr"));
      let minY = null, minM = null;
      for (const tr of rows) {
        const cell = tr.querySelector(SELECTORS.competenciaCell) || tr.querySelectorAll("td")[findCompetenciaColumnIndex(tableEl)];
        const txt = cell ? (cell.innerText || "") : (tr.innerText || "");
        const yy = extractYearFromCompetencia(txt);
        const mm = extractMonthFromCompetencia(txt);
        if (yy && mm) {
          if (minY === null) { minY = yy; minM = mm; }
          else {
            const cmp = compareYearMonth(yy, mm, minY, minM);
            if (cmp < 0) { minY = yy; minM = mm; }
          }
        }
      }
      if (minY && minM) {
        const cmpTarget = compareYearMonth(minY, minM, year, month || "01");
        if (cmpTarget < 0) break;
      }
    }
  }
  return Array.from(new Set(urls));
}

async function startDomDownloads(urls, status, spinner) {
  let started = 0;
  for (let i = 0; i < urls.length; i++) {
    const u = urls[i];
    const a = document.createElement("a");
    a.href = u;
    a.target = "_self";
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
    started++;
    if (status) status.textContent = `Downloads iniciados (${started}/${urls.length})`;
    await new Promise((r) => setTimeout(r, 250));
  }
  if (spinner) spinner.style.display = "none";
}

function toFileNameFromUrl(u, i) {
  try {
    const x = new URL(u);
    let name = x.pathname.split("/").pop() || "";
    if (!name || !name.includes(".")) name = `xml-${String(i + 1).padStart(4, "0")}.xml`;
    if (!name.toLowerCase().endsWith(".xml")) name += ".xml";
    return name;
  } catch {
    return `xml-${String(i + 1).padStart(4, "0")}.xml`;
  }
}

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

async function fetchXmlEntries(month, year, onProgress) {
  const urls = await collectXmlLinksAcrossPages(month, year || "");
  const entries = [];
  if (typeof onProgress === "function") onProgress(0);
  for (let i = 0; i < urls.length; i++) {
    const u = urls[i];
    const res = await fetch(u, {
      credentials: "include",
      headers: {
        "Accept": "application/xml,text/xml,*/*"
      },
      cache: "no-store"
    });
    if (!res.ok) continue;
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    let ab;
    if (ct.includes("xml")) {
      ab = await res.arrayBuffer();
    } else {
      const txt = await res.clone().text().catch(() => "");
      if (!txt || !/^<\?xml/i.test(txt)) continue;
      ab = new TextEncoder().encode(txt).buffer;
    }
    let name = toFileNameFromUrl(u, i);
    const cd = res.headers.get("content-disposition") || "";
    const m = cd.match(/filename=\"?([^\";]+)\"?/i);
    if (m && m[1]) {
      const fn = m[1].trim();
      if (fn) name = fn.toLowerCase().endsWith(".xml") ? fn : `${fn}.xml`;
    }
    entries.push({ name, data: new Uint8Array(ab) });
    const pct = Math.round(((i + 1) / urls.length) * 100);
    if (typeof onProgress === "function") onProgress(pct);
    await new Promise((r) => setTimeout(r, 150));
  }
  return entries;
}

async function main() {
  const tableEl = await waitForTable();
  if (!tableEl) return;
  const { select, yearSelect, button, zipButton, statusProcess, statusPercent, spinner, progress } = injectToolbar(tableEl);

  const updateSelection = () => {
    const month = select.value || "todos";
    const year = yearSelect.value || "";
    statusProcess.textContent = `Selecionado: ${month}${year ? "/" + year : ""}`;
    statusPercent.textContent = "";
  };
  select.addEventListener("change", updateSelection);
  yearSelect.addEventListener("change", updateSelection);
  updateSelection();

  button.addEventListener("click", async () => {
    button.disabled = true;
    zipButton.disabled = true;
    const month = select.value || "";
    const year = yearSelect.value || "";
    statusProcess.textContent = "Coletando XMLs...";
    statusPercent.textContent = "";
    spinner.style.display = "inline-block";
    try {
      const urls = await collectXmlLinksAcrossPages(month, year);
      if (!urls.length) {
        statusProcess.textContent = "Nenhum XML encontrado para o mês selecionado";
        return;
      }
      statusProcess.textContent = `Iniciando download de ${urls.length} arquivo(s)`;
      await startDomDownloads(urls, statusProcess, spinner);
    } catch (e) {
      statusProcess.textContent = "Erro ao coletar XMLs";
    } finally {
      button.disabled = true;
      zipButton.disabled = false;
      spinner.style.display = "none";
    }
  });

  zipButton.addEventListener("click", async () => {
    button.disabled = true;
    zipButton.disabled = true;
    const month = select.value || "";
    const year = yearSelect.value || "";
    statusProcess.textContent = "Gerando ZIP...";
    statusPercent.textContent = "0%";
    spinner.style.display = "inline-block";
    progress.style.display = "inline-block";
    progress.value = 0;
    try {
      const entries = await fetchXmlEntries(month, year, (p) => {
        progress.value = p;
        statusPercent.textContent = `${p}%`;
      });
      if (!entries.length) {
        statusProcess.textContent = "Nenhum XML encontrado para o mês selecionado";
        statusPercent.textContent = "";
        return;
      }
      const zip = createZipStore(entries);
      downloadBlob(zip, `nfse-xml-${month || "todos"}${year ? "-" + year : ""}.zip`);
      statusProcess.textContent = `ZIP com ${entries.length} arquivo(s)`;
      statusPercent.textContent = "";
    } catch (e) {
      statusProcess.textContent = "Erro ao gerar ZIP";
      statusPercent.textContent = "";
    } finally {
      button.disabled = true;
      zipButton.disabled = false;
      spinner.style.display = "none";
      progress.style.display = "none";
      progress.value = 0;
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => main());
} else {
  main();
}
