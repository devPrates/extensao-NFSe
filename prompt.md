# Contexto para Desenvolvimento da Extensão Chrome -- TRAE.AI

## Objetivo Geral

Desenvolver uma extensão para o Google Chrome que: - Injeta um campo de
filtro em uma tabela exibida em um site específico. - Permite filtrar
registros diretamente no front-end. - Faz a coleta de todos os registros
filtrados ou de todas as páginas da tabela, considerando paginação no
formato `?pg=2`, `?pg=3`, etc. - Realiza o download automático de
arquivos XML associados a cada registro listado.

## Escopo Funcional

1.  A extensão deve operar **dentro do ambiente da página**, utilizando
    scripts injetados para manipulação da DOM.
2.  O filtro deve ser inserido no topo da tabela e funcionar sem alterar
    o back-end do site.
3.  A extensão deve conseguir navegar por todas as páginas do recurso
    `Notas/Emitidas?pg=X`, coletando todos os links XML.
4.  Após a coleta completa, todos os arquivos XML devem ser baixados
    automaticamente.
5.  O processo deve funcionar em qualquer máquina local, utilizando
    instalação manual via `Load unpacked` no Chrome.

## Requisitos Técnicos

-   A extensão deve ser construída em **Manifest V3**.
-   Exige scripts de:
    -   Manipulação de DOM (content script)
    -   Gerenciamento de downloads (service worker)
    -   Controle de paginação
-   Permissões necessárias:
    -   Acesso ao domínio do site
    -   Permissão de downloads
    -   Injeção de scripts
-   Deve permitir instalação manual em múltiplas máquinas da empresa sem
    publicação na Web Store.

## Considerações de Paginação

-   O site utiliza paginação por query string (`?pg=1`, `?pg=2`,
    `?pg=3`...).
-   A extensão deve:
    -   Detectar a página atual
    -   Identificar existência de próxima página
    -   Navegar automaticamente até o final da paginação
    -   Coletar todos os links XML de todas as páginas
-   A coleta deve estar preparada para lidar com grande volume, exemplo:
    **700+ registros em 20+ páginas**.

## Fluxo Geral Esperado

1.  Usuário abre o site com a tabela.
2.  A extensão injeta o campo de filtro.
3.  O usuário filtra (opcional).
4.  O usuário aciona o comando de coleta.
5.  A extensão percorre todas as páginas automaticamente.
6.  Todos os links XML são acumulados e enviados para o módulo de
    download.
7.  Os arquivos são baixados localmente.

## Considerações de Testes Internos

-   A extensão será inicialmente instalada manualmente via:
    -   `chrome://extensions/`
    -   Modo desenvolvedor ativado
    -   "Load unpacked"
-   Após validação interna, poderá receber melhorias e, futuramente, ser
    empacotada ou publicada.

## Entrega Esperada pelo TRAE.AI

Este contexto deve ser utilizado pelo TRAE.AI para: - Gerar estrutura do
projeto - Definir arquitetura - Propor fluxos de interação - Criar
implementação passo a passo - Refinar comportamento da extensão -
Garantir compatibilidade com Chrome Manifest V3 - Não incluir código na
primeira etapa (exceto quando solicitado posteriormente)
