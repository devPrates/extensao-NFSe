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

async function main() {
  const tableEl = await (window.NFSE && NFSE.collect && NFSE.collect.waitForTable ? NFSE.collect.waitForTable() : Promise.resolve(null));
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
      const urls = await NFSE.collect.collectXmlLinksAcrossPages(month, year);
      if (!urls.length) {
        statusProcess.textContent = "Nenhum XML encontrado para o mês selecionado";
        return;
      }
      statusProcess.textContent = `Iniciando download de ${urls.length} arquivo(s)`;
      await NFSE.collect.startDomDownloads(urls, statusProcess, spinner);
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
      const entries = await NFSE.collect.fetchXmlEntries(month, year, (p) => {
        progress.value = p;
        statusPercent.textContent = `${p}%`;
      });
      if (!entries.length) {
        statusProcess.textContent = "Nenhum XML encontrado para o mês selecionado";
        statusPercent.textContent = "";
        return;
      }
      const zip = NFSE.zip.createZipStore(entries);
      NFSE.zip.downloadBlob(zip, `nfse-xml-${month || "todos"}${year ? "-" + year : ""}.zip`);
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
