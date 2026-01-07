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
    zipButton.innerHTML = `<span>Baixar .zip</span>`;
    zipButton.title = "Baixar todas as notas filtradas em ZIP";

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
    wrapper.appendChild(spinner);
    wrapper.appendChild(statusGroup);

    targetContainer.appendChild(wrapper);

    return { zipButton, statusText, spinner, progress };
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

    const { zipButton, statusText, spinner, progress } = ui;

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
