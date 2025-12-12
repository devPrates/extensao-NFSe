# NFS-e Extensão — Filtro e Download de XML

Extensão para Chrome que injeta uma barra de ferramentas na página de NFS-e Emitidas do Portal Contribuinte e permite:

- Filtrar por competência (`mês` e `ano`) diretamente na tabela
- Coletar links de XML de todas as páginas da listagem
- Baixar todos os XMLs visíveis
- Gerar um arquivo `.zip` com todos os XMLs filtrados


## Visão Geral

- Alvo: `https://www.nfse.gov.br/EmissorNacional/Notas/Emitidas*`
- Injeta controles na página para filtrar linhas pela competência e aciona downloads dos XMLs.
- Percorre automaticamente a paginação (`?pg=1`, `?pg=2`, …) para coletar todos os registros.
- Gera ZIP localmente sem dependências externas.

Principais arquivos:

- `manifest.json` — Declara a extensão, permissões e scripts (service worker e content script).
- `content.js` — Script injetado na página; constrói a UI, filtra tabela, coleta links, inicia downloads e gera ZIP.
- `background.js` — Service worker com suporte a downloads via API do Chrome.


## Instalação (Load Unpacked)

1. Abra `chrome://extensions/`
2. Ative o `Modo desenvolvedor`
3. Clique em `Carregar sem empacotamento`
4. Selecione o diretório do projeto
5. Confirme que a extensão aparece como ativa


## Como Usar

1. Acesse `https://www.nfse.gov.br/EmissorNacional/Notas/Emitidas`
2. Aguarde a injeção da barra “NFS-e Extensão” acima da tabela
3. Use os seletores de `Mês` e `Ano` conforme necessário
4. Clique em `Baixar Todos` para iniciar os downloads individuais dos XMLs
5. Opcionalmente, clique em `Gerar ZIP` para baixar um único arquivo `.zip` contendo todos os XMLs coletados

Estados e feedback:

- O texto de status indica quantidade de linhas visíveis e progresso
- Um spinner simples aparece durante coleta/geração


## Funcionalidades

- Filtro por competência (mês/ano) aplicado diretamente na tabela
- Coleta robusta de links de XML através de todas as páginas
- Download individual via DOM ou agregação em `.zip`
- Heurísticas para detectar tabela alvo e coluna “Competência”
- Tratamento de cabeçalhos `Content-Disposition` para nome de arquivo


## Arquitetura e Pontos-Chave

- Manifesto: `manifest.json:4–19`
  - `manifest_version`: 3
  - `host_permissions`: `https://www.nfse.gov.br/*`
  - `content_scripts`: mapeado para rota `Notas/Emitidas*`
  - `background.service_worker`: `background.js`

- Injeção de UI e fluxo principal: `content.js:543–610`
  - Cria `select` de mês e ano, botões `Baixar Todos` e `Gerar ZIP` e um `status`
  - Aplica filtro nas linhas: `content.js:210–220`
  - Coleta links por página e paginação: `content.js:294–338`
  - Downloads via DOM: `content.js:340–357`
  - Geração de ZIP (Store, sem compressão): `content.js:429–495` + `downloadBlob` em `content.js:497–506`

- Service Worker de download (opcional): `background.js:1–14`
  - Recebe mensagens `downloadXmlLinks` com lista de URLs e usa `chrome.downloads.download`


## Permissões

- `downloads` — baixar arquivos via API do Chrome
- `storage` — reservado para persistência futura (não usado atualmente)
- `host_permissions` — acesso ao domínio da NFS-e para leitura da página e fetch dos XMLs


## Limitações e Considerações

- Depende da estrutura atual da página do Portal Contribuinte; mudanças de HTML/CSS podem exigir ajustes
- Coleta utiliza `fetch` com `credentials: "include"`; requer sessão válida do usuário
- Para grandes volumes, o tempo total pode ser significativo; há atrasos pequenos entre requisições
- ZIP é gerado com método “store” (sem compressão) por simplicidade e compatibilidade
- O `background.js` está disponível, mas o fluxo padrão usa cliques DOM; pode-se alternar para API de `downloads` se preferir


## Solução de Problemas

- Barra não aparece: confirme a URL exata e recarregue a página
- Nenhum XML encontrado: verifique filtros de mês/ano e a sessão autenticada
- Erros intermitentes: reduza tráfego simultâneo, aguarde e tente novamente
- Mudança de tabela/colunas: ajuste os seletores em `content.js` (`SELECTORS`)


## Roadmap Sugerido

- Persistir preferências (mês/ano) com `chrome.storage`
- Adicionar compressão (Deflate) ao ZIP
- Telemetria mínima e logs visíveis (sem dados sensíveis)
- Modo de operação via `chrome.downloads` como padrão
- Testes automatizados de parsing e extração de competência


## Segurança

- Não armazena ou expõe credenciais; usa sessão ativa do usuário no site
- Não requer variáveis de ambiente; nenhum `.env` é necessário
- Evite publicar a extensão sem validação de conformidade interna


## Licença

Projeto interno. Uso restrito conforme políticas da organização.

