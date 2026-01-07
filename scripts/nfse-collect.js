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

  function collectXmlLinksFromTable(tableEl) {
    const rows = Array.from(tableEl.querySelectorAll("tbody tr"));
    const urls = [];
    rows.forEach((tr) => {
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

  async function collectXmlLinksAcrossPages() {
    const currentUrl = new URL(window.location.href);
    // Preserva os parametros atuais (filtros) e ajusta apenas a pagina
    const baseUrl = currentUrl.origin + currentUrl.pathname;
    const currentParams = new URLSearchParams(currentUrl.search);
    
    const currentDoc = document;
    const maxPage = getMaxPageFromDoc(currentDoc);
    const urls = [];

    for (let pg = 1; pg <= maxPage; pg++) {
      currentParams.set("pg", pg.toString());
      const url = `${baseUrl}?${currentParams.toString()}`;
      
      let doc;
      const currentPgParam = parseInt(new URLSearchParams(window.location.search).get("pg") || "1", 10);
      
      if (pg === currentPgParam) {
        doc = currentDoc;
      } else {
        // Pequeno delay para evitar bloqueio
        await new Promise((r) => setTimeout(r, 200));
        const html = await fetchPageHtml(url);
        doc = parseHtmlToDoc(html);
      }

      const table = findTargetTable(doc);
      if (table) {
        const pageUrls = collectXmlLinksFromTable(table);
        urls.push(...pageUrls);
      }
    }
    return urls;
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

  async function fetchXmlEntries(onProgress) {
    const urls = await collectXmlLinksAcrossPages();
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
