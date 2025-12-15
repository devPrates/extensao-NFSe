(() => {
  const SELECTORS = {
    table: "table.table.table-striped",
    paginationLink: 'a[href*="Notas/Emitidas?pg="]',
    competenciaCell: "td.td-competencia",
    xmlLink: 'a[href*="/EmissorNacional/Notas/Download/NFSe/"]'
  };

  function normalize(s) {
    return (s || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  }

  function getCandidateTables(doc = document) {
    const specific = Array.from(doc.querySelectorAll(SELECTORS.table));
    if (specific.length) return specific;
    return Array.from(doc.querySelectorAll("table"));
  }
  function findTargetTable(doc = document) {
    const tables = getCandidateTables(doc);
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

  async function fetchXmlEntries(month, year, onProgress) {
    const urls = await collectXmlLinksAcrossPages(month, year || "");
    const entries = [];
    if (typeof onProgress === "function") onProgress(0);
    for (let i = 0; i < urls.length; i++) {
      const u = urls[i];
      const res = await fetch(u, {
        credentials: "include",
        headers: { "Accept": "application/xml,text/xml,*/*" },
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

  window.NFSE = window.NFSE || {};
  window.NFSE.collect = {
    waitForTable,
    collectXmlLinksAcrossPages,
    startDomDownloads,
    fetchXmlEntries
  };
})();
