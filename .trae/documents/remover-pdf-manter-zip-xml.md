## Resumo
Objetivo: remover completamente qualquer funcionalidade relacionada a PDF (relatório em PDF e/ou DANFS-e/PDFs em ZIP) e manter somente **um botão** para baixar **XMLs em um único .zip**, percorrendo todas as páginas do resultado **já filtrado pelos inputs Data Inicial / Data Final** (filtro nativo do site).

Sucesso = na tela **NFS-e Emitidas**, após o usuário aplicar o filtro (Data Inicial/Data Final) e clicar em **Filtrar**, a extensão oferece apenas:
- Botão **Baixar ZIP** (XML)
- O ZIP contém somente os XMLs do intervalo filtrado, somando todas as páginas.

## Análise do Estado Atual (repo)
Arquivos relevantes:
- [manifest.json](file:///c:/Users/Acer/Desktop/Prates/Sistemas/extensao-NFSe/manifest.json)
  - Atualmente carrega bibliotecas de PDF (`lib/jspdf.umd.min.js`, `lib/jspdf.plugin.autotable.min.js`) além dos scripts da extensão.
- [content.js](file:///c:/Users/Acer/Desktop/Prates/Sistemas/extensao-NFSe/content.js)
  - Injeta 2 botões: **Baixar ZIP** (XML) e **Baixar PDFs** (DANFS-e em ZIP).
- [scripts/nfse-collect.js](file:///c:/Users/Acer/Desktop/Prates/Sistemas/extensao-NFSe/scripts/nfse-collect.js)
  - Tem fluxo de coleta de XML com paginação preservando query string (bom para respeitar filtro).
  - Também contém lógica de PDF: seletor `pdfLink`, `collectPdfLinksAcrossPages`, `fetchPdfEntries`.
  - Também contém funções de relatório/tabela (`collectTableDataAcrossPages`) herdadas de tentativas anteriores.
- [scripts/nfse-zip.js](file:///c:/Users/Acer/Desktop/Prates/Sistemas/extensao-NFSe/scripts/nfse-zip.js)
  - Implementa a geração de ZIP (store) e download do blob.

Código-fonte de referência do site:
- [condigo fonte.txt](file:///c:/Users/Acer/Desktop/Prates/Sistemas/extensao-NFSe/docs/condigo%20fonte.txt)
  - Confirma que o filtro é via GET e a tabela/paginação está em `/EmissorNacional/Notas/Emitidas`.

## Mudanças Propostas (decision-complete)

### 1) Remover dependências de PDF do Manifest
Arquivo: [manifest.json](file:///c:/Users/Acer/Desktop/Prates/Sistemas/extensao-NFSe/manifest.json)
- Remover `lib/jspdf.umd.min.js` e `lib/jspdf.plugin.autotable.min.js` da lista `content_scripts[0].js`
- Manter somente:
  - `scripts/nfse-zip.js`
  - `scripts/nfse-collect.js`
  - `content.js`

### 2) Remover UI/fluxo de PDF do content script
Arquivo: [content.js](file:///c:/Users/Acer/Desktop/Prates/Sistemas/extensao-NFSe/content.js)
- Remover criação/injeção do botão azul (hoje “Baixar PDFs”)
- Remover o handler associado (hoje chama `NFSE.collect.fetchPdfEntries`)
- Ajustar retorno de `injectDownloadButtons` e destructuring no `main()` para existir apenas `zipButton` + elementos de status
- Garantir que o botão **Baixar ZIP** continue:
  - desabilitando durante execução
  - exibindo progresso
  - chamando `NFSE.collect.fetchXmlEntries(...)`
  - gerando ZIP via `NFSE.zip.createZipStore(entries)`

### 3) Remover coleta de PDF e funcionalidades de relatório do coletor
Arquivo: [scripts/nfse-collect.js](file:///c:/Users/Acer/Desktop/Prates/Sistemas/extensao-NFSe/scripts/nfse-collect.js)
- Remover completamente:
  - `SELECTORS.pdfLink`
  - `findPdfLinkInRow`, `collectPdfLinksFromTable`
  - `collectPdfLinksAcrossPages`
  - `toPdfFileNameFromUrl`, `fetchPdfEntries`
  - Export desses métodos em `window.NFSE.collect`
- Remover também o que não é mais necessário para XML-zip:
  - `extractTableDataFromPage`, `collectTableDataAcrossPages` e todo o pós-processamento (era para relatório)
- Manter apenas API mínima usada pelo `content.js`:
  - `waitForTable`
  - `collectXmlLinksAcrossPages`
  - `fetchXmlEntries`
  - (opcional) `startDomDownloads` pode ficar, mas não é mais usado pela UI; remover se estiver 100% sem uso.

### 4) Garantir paginação robusta com filtro (ordem de query params)
Arquivo: [scripts/nfse-collect.js](file:///c:/Users/Acer/Desktop/Prates/Sistemas/extensao-NFSe/scripts/nfse-collect.js)
Motivo: quando o filtro por data está aplicado, é comum a paginação carregar URLs com múltiplos parâmetros (`datainicio`, `datafim`, `pg`) onde `pg` pode não ser o primeiro.

Mudança:
- Atualizar `SELECTORS.paginationLink` de:
  - `a[href*="Notas/Emitidas?pg="]`
- Para um seletor que funcione independentemente da ordem:
  - `a[href*="Notas/Emitidas"][href*="pg="]`

Isso garante que `getMaxPageFromDoc()` consiga achar corretamente a última página e que o ZIP inclua todos os XMLs do intervalo filtrado.

### 5) Limpeza de arquivos de bibliotecas (opcional, mas recomendado)
Pasta: `lib/`
- Após remover do `manifest.json`, avaliar remover `lib/jspdf.umd.min.js` e `lib/jspdf.plugin.autotable.min.js`.
- Se o usuário preferir manter a pasta no repo, não remove (apenas deixa sem uso).

## Assunções e Decisões
- O filtro nativo (Data Inicial/Data Final) é aplicado via GET, e seus parâmetros ficam na query string; a coleta de páginas preserva essa query string e altera apenas `pg`.
- O link de download de XML segue o padrão já usado no seletor: `/EmissorNacional/Notas/Download/NFSe/`.
- Fora de escopo: qualquer download/ZIP de DANFS-e (PDF) e qualquer geração de relatório em PDF.

## Verificação (após implementação)
- Recarregar extensão em `chrome://extensions` (Load unpacked) ou apenas “recarregar” a extensão.
- Abrir `NFS-e Emitidas`, aplicar um intervalo de datas, clicar em **Filtrar**.
- Clicar em **Baixar ZIP**:
  - Verificar progresso (0–100)
  - Verificar que o ZIP contém somente `.xml`
  - Verificar que a quantidade de XMLs corresponde ao total de registros/páginas do filtro.
- Validar que não há erros de console relacionados a `jspdf`, `autoTable` ou `fetchPdfEntries`.

