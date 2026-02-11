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

  function extractTableDataFromPage(tableEl) {
    const headers = [];
    const rows = [];

    // Extract Headers
    const thead = tableEl.querySelector("thead");
    if (thead) {
        const ths = Array.from(thead.querySelectorAll("th"));
        ths.forEach(th => headers.push(th.innerText.trim()));
    } else {
        // Fallback if no thead, try first row if it looks like header or just skip
        // For NFSe usually there is a thead.
    }

    // Extract Rows
    const trs = Array.from(tableEl.querySelectorAll("tbody tr"));
    trs.forEach(tr => {
        const rowData = [];
        const tds = Array.from(tr.querySelectorAll("td"));
        tds.forEach(td => rowData.push(td.innerText.trim()));
        if (rowData.length > 0) rows.push(rowData);
    });

    return { headers, rows };
  }

  async function collectTableDataAcrossPages() {
    const currentUrl = new URL(window.location.href);
    const baseUrl = currentUrl.origin + currentUrl.pathname;
    const currentParams = new URLSearchParams(currentUrl.search);
    
    const currentDoc = document;
    const maxPage = getMaxPageFromDoc(currentDoc);
    
    let allHeaders = [];
    let allRows = [];

    for (let pg = 1; pg <= maxPage; pg++) {
      currentParams.set("pg", pg.toString());
      const url = `${baseUrl}?${currentParams.toString()}`;
      
      let doc;
      const currentPgParam = parseInt(new URLSearchParams(window.location.search).get("pg") || "1", 10);
      
      if (pg === currentPgParam) {
        doc = currentDoc;
      } else {
        await new Promise((r) => setTimeout(r, 200));
        const html = await fetchPageHtml(url);
        doc = parseHtmlToDoc(html);
      }

      const table = findTargetTable(doc);
      if (table) {
        const { headers, rows } = extractTableDataFromPage(table);
        if (pg === 1 && headers.length > 0) {
            allHeaders = headers;
        }
        allRows.push(...rows);
      }
    }

    // --- Processamento de Colunas (Solicitação do Usuário) ---
    // 1. Identificar índices
    const idxSituacao = allHeaders.findIndex(h => h.toLowerCase().includes("situacao") || h.toLowerCase().includes("situação"));
    const idxEmitidaPara = allHeaders.findIndex(h => h.toLowerCase().includes("emitida para") || h.toLowerCase().includes("tomador"));

    // 2. Processar Rows
    const processedRows = allRows.map(row => {
        let newRow = [...row];
        
        // Separar CPF/CNPJ e Nome (se coluna encontrada)
        // Formato esperado: "xxx.xxx.xxx-xx - Nome Sobrenome"
        if (idxEmitidaPara !== -1) {
            const originalValue = newRow[idxEmitidaPara] || "";
            // Regex tenta capturar (CPF/CNPJ) + (Hífen opcional) + (Resto Nome)
            // Ex: "000.000.000-00 - Fulano de Tal"
            // Captura 1: CPF/CNPJ (chars, pontos, traços, barras)
            // Captura 2: Nome (resto da string após o primeiro separador " - " ou similar)
            
            let cpfCnpj = "";
            let nome = "";

            // Tenta separar pelo padrão " - " que geralmente divide o documento do nome
            const separatorRegex = /\s+-\s+(.+)/;
            const match = originalValue.match(separatorRegex);

            if (match) {
                // Se achou " - ", o que vem antes é o doc, o que vem depois (match[1]) é o nome
                const splitIndex = originalValue.indexOf(match[0]);
                cpfCnpj = originalValue.substring(0, splitIndex).trim();
                nome = match[1].trim();
            } else {
                // Fallback: se não achar o separador padrão, tenta pegar a primeira palavra como doc se parecer um doc
                const parts = originalValue.split(" ");
                if (parts.length > 1 && /\d/.test(parts[0])) {
                    cpfCnpj = parts[0];
                    nome = parts.slice(1).join(" ");
                } else {
                    nome = originalValue; // Tudo é nome ou formato desconhecido
                }
            }
            
            // Substitui o valor original pelos dois novos
            newRow.splice(idxEmitidaPara, 1, cpfCnpj, nome);
        }

        // Remover coluna Situação (se encontrada)
        // Nota: Se idxSituacao > idxEmitidaPara, o índice muda após o splice anterior (aumentou 1).
        // Se idxSituacao < idxEmitidaPara, o índice se mantem.
        // Vamos recalcular o índice de remoção baseado na mudança de tamanho
        
        return newRow;
    });

    // Remover coluna Situação das linhas processadas
    if (idxSituacao !== -1) {
        // Precisamos ajustar o índice se ele estiver DEPOIS da coluna expandida (Emitida Para)
        let removeIdx = idxSituacao;
        if (idxEmitidaPara !== -1 && idxSituacao > idxEmitidaPara) {
            removeIdx += 1; // Adicionamos 1 coluna (eram 1 viraram 2, saldo +1)
        }
        
        processedRows.forEach(row => row.splice(removeIdx, 1));
    }

    // 3. Processar Headers
    let processedHeaders = [...allHeaders];
    
    if (idxEmitidaPara !== -1) {
        processedHeaders.splice(idxEmitidaPara, 1, "CPF/CNPJ", "Nome");
    }

    if (idxSituacao !== -1) {
        let removeIdx = idxSituacao;
        if (idxEmitidaPara !== -1 && idxSituacao > idxEmitidaPara) {
            removeIdx += 1;
        }
        processedHeaders.splice(removeIdx, 1);
    }

    // --- Novos Filtros (Solicitação: Remover Ações e Mover Valor) ---

    // A. Remover Coluna de Ações (Visualizar/Cancelar/etc)
    // Geralmente é a última coluna e muitas vezes não tem texto no header ou tem algo generico
    // Vamos identificar pelo conteúdo das linhas se possível ou assumir a última se tiver palavras chave
    let idxAcoes = processedHeaders.findIndex(h => {
        const t = h.toLowerCase();
        return t.includes("visualizar") || t.includes("cancelar") || t.includes("danfs-e") || t.trim() === "";
    });

    // Se não achou pelo header, verifica a última coluna da primeira linha E de uma linha do meio para garantir
    if (idxAcoes === -1 && processedRows.length > 0) {
        const lastIdx = processedHeaders.length - 1;
        const checkContent = (row) => {
             const c = (row[lastIdx] || "").toLowerCase();
             return c.includes("visualizar") || c.includes("cancelar") || c.includes("danfs");
        };
        
        if (checkContent(processedRows[0]) || (processedRows.length > 5 && checkContent(processedRows[5]))) {
            idxAcoes = lastIdx;
        }
    }

    if (idxAcoes !== -1) {
        processedHeaders.splice(idxAcoes, 1);
        processedRows.forEach(row => row.splice(idxAcoes, 1));
    }

    // B. Mover Coluna Valor para o Final e Calcular Total
    let totalValue = 0;
    let idxValor = processedHeaders.findIndex(h => {
        const t = h.toLowerCase();
        return t.includes("valor") || t.includes("preço") || t === "r$";
    });

    if (idxValor !== -1) {
        // Se não for a última, move para o final
        if (idxValor !== processedHeaders.length - 1) {
            // Remove do header e adiciona no final
            const headerCol = processedHeaders.splice(idxValor, 1)[0];
            processedHeaders.push(headerCol);

            // Remove das linhas e adiciona no final
            processedRows.forEach(row => {
                if (row.length > idxValor) {
                    const val = row.splice(idxValor, 1)[0];
                    row.push(val);
                }
            });
            
            // O novo índice de valor agora é o último
            idxValor = processedHeaders.length - 1;
        }

        // Calcular Soma
        processedRows.forEach(row => {
            const valStr = row[idxValor] || "0";
            // Limpa: Remove R$, remove pontos de milhar, troca virgula decimal por ponto
            // Ex: "R$ 1.234,56" -> "1234.56"
            const cleanStr = valStr.replace(/[^\d,]/g, "").replace(",", ".");
            const valFloat = parseFloat(cleanStr);
            if (!isNaN(valFloat)) {
                totalValue += valFloat;
            }
        });
    }

    return { headers: processedHeaders, rows: processedRows, totalValue };
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
    collectTableDataAcrossPages,
    startDomDownloads,
    fetchXmlEntries
  };
})();
