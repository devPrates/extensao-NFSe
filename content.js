(() => {
  // Configuração e estilos
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
      
      .nfse-ext-btn {
        margin-left: 10px;
        display: inline-flex;
        align-items: center;
        gap: 5px;
      }
    `;
    document.head.appendChild(style);
  }

  // Encontra o container do botão de filtro para injetar nossos botões ao lado
  function findFilterContainer() {
    // Procura pelo botão de filtrar
    const imgs = Array.from(document.querySelectorAll('img[src*="btn-filtrar"]'));
    for (const img of imgs) {
      const btn = img.closest('button');
      if (btn) {
        // Tenta encontrar o container pai imediato (form-group) e depois o container flex
        const formGroup = btn.closest('.form-group');
        if (formGroup) {
          // Opção A: Injetar dentro do mesmo container pai se for flex
          const parent = formGroup.parentElement;
          if (parent && getComputedStyle(parent).display === 'flex') {
            return parent;
          }
          // Opção B: Retornar o próprio formGroup para injetar depois dele
          return formGroup.parentElement || formGroup;
        }
        return btn.parentElement;
      }
    }
    // Fallback: tenta encontrar a tabela e injetar antes dela
    const table = document.querySelector('table.table-striped');
    return table ? table.parentElement : null;
  }

  function injectDownloadButtons(targetContainer) {
    if (!targetContainer) return null;
    if (document.getElementById("nfse-ext-zip-all")) return null;

    const wrapper = document.createElement("div");
    wrapper.className = "form-group form-group-lg nfse-ext-btn"; // imita estilo da pagina
    wrapper.style.display = "flex";
    wrapper.style.alignItems = "center";
    wrapper.style.marginLeft = "10px";

    // Botão ZIP
    const zipButton = document.createElement("button");
    zipButton.id = "nfse-ext-zip-all";
    zipButton.className = "btn btn-lg btn-success"; // Estilo diferente para destaque
    zipButton.type = "button";
    zipButton.innerHTML = `<span>Baixar ZIP</span>`;
    zipButton.title = "Baixar todas as notas filtradas em ZIP";

    // Botão Relatório PDF
    const pdfButton = document.createElement("button");
    pdfButton.id = "nfse-ext-pdf-report";
    pdfButton.className = "btn btn-lg btn-primary"; // Estilo azul
    pdfButton.type = "button";
    pdfButton.style.marginLeft = "5px";
    pdfButton.innerHTML = `<span>Emitir Relatório</span>`;
    pdfButton.title = "Gerar relatório PDF com dados da tabela";

    // Elementos de status
    const statusGroup = document.createElement("div");
    statusGroup.style.display = "flex";
    statusGroup.style.flexDirection = "column";
    statusGroup.style.marginLeft = "10px";
    statusGroup.style.fontSize = "12px";
    statusGroup.style.lineHeight = "1.2";

    const spinner = document.createElement("span");
    spinner.className = "nfse-ext-spinner";
    spinner.style.display = "none";

    const statusText = document.createElement("span");
    statusText.textContent = "";

    const progress = document.createElement("progress");
    progress.max = 100;
    progress.value = 0;
    progress.style.width = "100px";
    progress.style.display = "none";
    progress.style.marginTop = "2px";

    statusGroup.appendChild(statusText);
    statusGroup.appendChild(progress);

    wrapper.appendChild(zipButton);
    wrapper.appendChild(pdfButton);
    wrapper.appendChild(spinner);
    wrapper.appendChild(statusGroup);

    targetContainer.appendChild(wrapper);

    return { zipButton, pdfButton, statusText, spinner, progress };
  }

  async function main() {
    ensureStyles();

    // Aguarda tabela ou botão de filtro
    const tableEl = await (window.NFSE && NFSE.collect && NFSE.collect.waitForTable ? NFSE.collect.waitForTable() : Promise.resolve(null));
    
    // Tenta encontrar o local de injeção
    const filterContainer = findFilterContainer();
    
    if (!filterContainer && !tableEl) {
        console.log("NFSe Extension: Local de injeção não encontrado.");
        return;
    }

    // Prefere injetar no container do filtro, senão antes da tabela
    const target = filterContainer || (tableEl ? tableEl.parentElement : document.body);
    
    const ui = injectDownloadButtons(target);
    if (!ui) return; // Já injetado ou erro

    const { zipButton, pdfButton, statusText, spinner, progress } = ui;

    // Handler para Relatório PDF
    pdfButton.addEventListener("click", async () => {
      zipButton.disabled = true;
      pdfButton.disabled = true;
      statusText.textContent = "Coletando dados...";
      spinner.style.display = "inline-block";
      
      try {
        const { headers, rows, totalValue } = await NFSE.collect.collectTableDataAcrossPages();

        if (!rows || !rows.length) {
          statusText.textContent = "Nenhum dado encontrado.";
          return;
        }

        statusText.textContent = "Gerando PDF...";
        await new Promise(r => requestAnimationFrame(r));

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('l', 'mm', 'a4'); // Paisagem para caber mais colunas

        doc.setFontSize(16);
        doc.text("Relatório de Notas Fiscais", 14, 15);
        
        doc.setFontSize(10);
        doc.text(`Gerado em: ${new Date().toLocaleString()}`, 14, 22);
        doc.text(`Total de registros: ${rows.length}`, 14, 27);
        
        // Formata e exibe o valor total
        const formattedTotal = (totalValue || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        doc.setFont(undefined, 'bold');
        doc.text(`Valor Total: ${formattedTotal}`, 14, 32);
        doc.setFont(undefined, 'normal');

        doc.autoTable({
          head: [headers],
          body: rows,
          startY: 37, // Ajustado para dar espaço ao Valor Total
          theme: 'striped',
          styles: { fontSize: 7, cellPadding: 1, overflow: 'linebreak' },
          headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
          columnStyles: { 0: { cellWidth: 'auto' } } // Ajuste automático
        });

        const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        doc.save(`relatorio-nfse-${timestamp}.pdf`);
        
        statusText.textContent = "PDF gerado!";
      } catch (e) {
        console.error(e);
        statusText.textContent = "Erro ao gerar PDF.";
      } finally {
        zipButton.disabled = false;
        pdfButton.disabled = false;
        spinner.style.display = "none";
      }
    });

    // Handler para Download ZIP
    zipButton.addEventListener("click", async () => {
      zipButton.disabled = true;
      statusText.textContent = "Preparando...";
      spinner.style.display = "inline-block";
      progress.style.display = "inline-block";
      progress.value = 0;

      try {
        // Coleta links respeitando a query string atual (filtros)
        const entries = await NFSE.collect.fetchXmlEntries((p) => {
          progress.value = p;
          statusText.textContent = `Baixando: ${p}%`;
        });

        if (!entries || !entries.length) {
          statusText.textContent = "Nenhum XML encontrado.";
          return;
        }

        statusText.textContent = "Gerando ZIP...";
        // Pequeno delay para UI atualizar
        await new Promise(r => requestAnimationFrame(r));

        const zip = NFSE.zip.createZipStore(entries);
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        NFSE.zip.downloadBlob(zip, `nfse-filtradas-${timestamp}.zip`);
        
        statusText.textContent = `Concluído: ${entries.length} arquivos.`;
      } catch (e) {
        console.error(e);
        statusText.textContent = "Erro no processo.";
      } finally {
        zipButton.disabled = false;
        spinner.style.display = "none";
        setTimeout(() => {
            progress.style.display = "none";
        }, 3000);
      }
    });
  }

  // Inicia se o DOM já estiver pronto ou aguarda
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", main);
  } else {
    main();
  }
})();
