## Context

Ver [proposal.md](proposal.md). O repositório não tem código de aplicação nem especificações anteriores. As fontes de produto são o README original e [a inspeção](../../../docs/figma-inspection/README.md): 15 frames, quatro imagens PNG, estilos/componentes e instruções escritas; não há conexões de protótipo. Os dados ilustrativos e alguns atributos antigos conflitam entre si.

Documentos integrantes deste design: [decisões](decisions.md), [contratos](contracts.md), [referências visuais](ui-reference-matrix.md), [verificação](verification.md) e [rastreabilidade](traceability.md). Todos fecham decisões; não transferem escolhas de escopo para o implementador.

**Atualização de 06/11/2026:** por decisão do usuário, pixel perfect deixou de ser requisito. As exigências deste design, das specs e tarefas prevalecem sobre menções anteriores a coincidência exata, tolerância zero ou bloqueio por divergências de pixels nos documentos auxiliares. Eles continuam úteis para localizar referências e executar os demais gates, sem ampliar o critério visual. A decisão anterior de manter as cores do hero conforme o Figma permanece; o contraste medido deve ser registrado honestamente.

## Goals / Non-Goals

**Goals:** separar transporte, simulação e apresentação; manter uma única identidade/cotação por recurso; recuperar operações após falhas; reproduzir os componentes e os 15 frames com diferenças justificadas e localizáveis; permitir avaliação em checkout limpo e hospedagem estática.

**Non-Goals:** backend privado, segurança de custódia, pagamentos/identidade/blockchain reais, novas páginas fora do teste ou reconstrução do Figma. O armazenamento do mock é o servidor simulado do navegador, não uma fronteira de segurança para dados reais. Não haverá bifurcação de negócio exclusiva para testes/auditoria.

## Decisions

### D01 Fontes e resolução de divergências

O README governa comportamento e critérios; o Figma governa composição/estilos e instruções dos componentes. Propriedades atuais resolvidas no inspetor prevalecem sobre nomes/atributos antigos do binário. A fonte `.fig` preservada é o snapshot de referência; mudanças posteriores do arquivo externo não entram automaticamente. Comentários de participantes não são requisitos. Informações inacessíveis não são tratadas como fatos.

Priorizar o MCP do Figma; quando não fornecer a informação necessária, usar a cópia no navegador ou o arquivo `.fig` preservado. Registrar origem e incertezas e revisar as telas com as referências, concentrando-se em identidade, composição, conteúdo e comportamento. Não exigir equivalência pixel perfect; um refinamento posterior depende de nova solicitação do usuário.

Conflitos funcionais são resolvidos por identidade estável e cotação da API, com desvios pontuais registrados. Diferenças intencionais e os defeitos de composição explicitamente congelados são preservados quando não impedem operação/acessibilidade. A alternativa de corrigir livremente o layout foi descartada pela exigência de fidelidade; congelar números incompatíveis foi descartado pelo README. Os 50 itens da inspeção têm decisão em `decisions.md`.

### D02 Stack, execução e limites de módulos

Aplicação SPA React/TypeScript, Vite e npm com lockfile. Node **24.x LTS** e npm compatível serão fixados no repositório; a versão local 25 não é requisito da entrega. Na tarefa de bootstrap serão fixados patches publicados e compatíveis das famílias React 19, Router 1, Query 5, Axios 1, Tailwind 4, MSW 2, Socket.IO client 4, Playwright 1, Lighthouse e TypeScript, sem ranges flutuantes no lockfile. Lockfile e smoke no Node escolhido são o gate de instalação, não uma presunção de compatibilidade por números de versão. O bootstrap registra as versões efetivamente instaladas e seus engines/peers.

Organização por responsabilidades:

- `src/app`: bootstrap, router, providers, QueryClient, fronteira de sessão e estilos globais;
- `src/shared`: contratos, validação, Money em wei, Axios, componentes shadcn adaptados e assets;
- `src/features`: catálogo, favoritos, carrinho, autenticação, conta, checkout e pedidos;
- `src/realtime`: conexão Socket.IO e sincronização de recursos;
- `src/mocks`: handlers HTTP/WebSocket, repositório IndexedDB, fixtures, relógio e controles;
- `tests`: E2E, baselines, contratos/invariantes críticos e relatórios;
- `public`: assets locais, fontes e `mockServiceWorker.js`.

Features só acessam dados pelo Axios/Query e eventos pela camada realtime. Não importam repositório, fixtures ou controles dos mocks. A alternativa de manter arrays fictícios em hooks/componentes é incompatível com o teste.

### D03 Inicialização da simulação e persistência

`VITE_ENABLE_MOCKS=true` em desenvolvimento com mocks e build de demonstração. O bootstrap aguarda a inicialização do repositório e de MSW antes de montar consultas e importar/criar o cliente Socket.IO, para interceptar o WebSocket nativo desde sua criação. Falha de inicialização mostra erro recuperável; não cai silenciosamente em um backend inexistente.

IndexedDB mantém usuários/hashes, sessões, catálogo, favoritos, carrinhos, cotações, carteiras, perfil, assets de avatar, pedidos, reservas, ledger de efeitos e configuração/relógio do cenário. Transações atômicas coordenam estoque, idempotência e limpeza de carrinho. Não executar crypto assíncrono ou rede dentro de uma transação IDB aberta: preparar dados antes e conferir a revisão no commit.

O cliente persiste somente token fictício, visitorId e drafts/hints privados com ownerId; dados remotos não recebem um segundo cache persistido. Senhas existem apenas nos inputs/requisições transitórias; usuários seed guardam hashes precomputados e contas criadas/mudadas usam PBKDF2-HMAC-SHA256, salt aleatório de 16 bytes e 600.000 iterações via Web Crypto. Credenciais fictícias documentadas servem exclusivamente à demonstração. Não registrar bodies de senha nem guardá-los em drafts/traces customizados.

Reset elimina todas as stores, tokens, drafts, conexões e caches da geração anterior e recria integralmente o cenário. DB indisponível/corrompido produz orientação de reset e erro; não simula persistência bem-sucedida em memória. Testes usam browser contexts isolados.

### D04 Contratos, dinheiro e domínio

[contracts.md](contracts.md) define operações, DTOs, erros e revisões. Validação compartilhada na borda HTTP, com schemas tipados; cliente trata resposta inválida como erro de contrato recuperável. O mock implementa os contratos sem caminhos alternativos de negócio.

ETH trafega como decimal string com no máximo 18 casas. Cálculos usam inteiros BigInt de wei. Quantidades são inteiros positivos limitados pela disponibilidade. Desconto é valor positivo, subtraído do subtotal; taxa padrão da fixture é 0.016 ETH, também modificável pelo cenário. Nenhum float participa de multiplicação/soma monetária. Todas as redes continuam expressas em ETH por contrato do teste, sem inventar conversão de moedas reais.

NFT tem `id` opaco, `tokenId`, slug/nome, categoria, rede, arte canônica, galeria, preço e modalidades `one-of-one`, `one-of-ten`, `one-of-fifty`, `open`. Cada edição tem disponibilidade e versão. Rótulos de edição são 1/1, 1/10, 1/50, ABERTA em ambos os tamanhos. Preços/nomes/arte canônicos dos produtos identificáveis vêm da home/detalhe; o token de Violet é #0314 e de Ivory #0088, coerentes com checkout/recibo. Não mudar identidade por breakpoint ou abertura de autenticação.

### D05 Rotas, URL e retorno

Rotas públicas: `/`, `/nfts/$nftId`, `/cart`, `/login`, `/signup`. Rotas privadas: `/checkout`, `/orders/$orderId`, `/profile`, `/wallets`, `/favorites`. A lista de favoritos reaproveita grid e menu existentes; não cria atividade/ofertas. `/orders/$orderId` representa estados do pedido, com recibo somente em confirmado. Rota desconhecida tem 404 com volta ao catálogo.

Busca da home: `q`, `category` e `network` repetíveis, `min`, `max`, `sort`, `page`, `tab`. Normalização ordena/deduplica arrays e descarta enums inválidos; página positiva, faixa válida em wei. Valores inválidos são substituídos pelo padrão e a URL é corrigida com replace. Alterar filtros/busca/tab/sort reinicia page=1. Digitação é confirmada após debounce de 300 ms, sem criar uma entrada de histórico por tecla; aplicar filtro, ordenar e paginar criam entradas navegáveis. Refresh/back/forward recuperam estado sem useState paralelo contraditório.

Ordem padrão `recent`; menu contém somente Recentes, Nome A–Z, Nome Z–A, Menor preço e Maior preço: operações sobre campos já presentes, não relato de visitante. `tab=new` ordena por createdAt descendente e `tab=trending` por ratingCount descendente, ambos campos do catálogo; sort escolhido prevalece sobre o padrão da aba. Categorias combinam OR entre si, redes OR entre si, dimensões diferentes AND, faixa inclusiva. Página de nove itens em todos os tamanhos, para não alterar resultados por viewport; o mobile continua a lista por rolagem.

`returnTo` aceita apenas rotas relativas desta aplicação, sem protocolo/host; login/cadastro preservam filtros e destino. Acesso direto a auth usa home como fundo desktop e não exige histórico anterior. Fechar auth volta ao returnTo válido ou home; login/cadastro bem-sucedido retorna ao contexto. Voltar mobile usa histórico interno válido, senão home (detalhe), cart (checkout) ou home (cart). Fechar pedido retorna ao catálogo; o pedido continua acessível pela URL.

### D06 Estado remoto, isolamento e concorrência

Query keys incluem recurso, parâmetros normalizados, ownerId e geração de sessão para dados privados; catálogo público não recebe dados privados. Queries GET: staleTime 30 s para catálogo/detalhe e 0 para cotação/pedido/carrinho; gcTime 5 min. Reconciliação em foco/reconexão e invalidação por mutations/eventos. GET tem até duas tentativas adicionais para rede/5xx (250/500 ms), sem retry para 4xx; mutations não têm retry automático. Axios possui timeout padrão de 10 s e recebe AbortSignal do Query.

401 inicia uma única transição de expiração: interrompe subscriptions, cancela requests privados, remove caches privados, limpa senhas e conserva apenas draft seguro do mesmo owner/contexto para nova autenticação. Logout/troca de usuário apagam também esses drafts e rotacionam visitorId; nunca copiam carrinho privado para o visitante. Token/owner mudado em outra aba invalida a sessão local por evento de storage. Sessão simulada expira em 30 minutos do relógio do cenário.

Favoritos usam atualização otimista com cancelamento da query correspondente, snapshot, rollback em falha e refetch ao finalizar. Rollback só se aplica à mesma geração/operação e não pode reverter uma mutation posterior. Respostas REST e eventos com versões antigas não sobrescrevem recursos novos; listas têm catalogVersion para descartar resultados calculados antes de alteração de preço/filtro/estoque.

### D07 Carrinho, autenticação e merge

Carrinho tem proprietário visitante ou userId, `revision`, linhas com IDs estáveis por geração, NFT/edição e quantidade. No login/cadastro, merge idempotente de visitorId no carrinho do usuário soma quantidades da mesma combinação até o estoque disponível; excedente é informado, não descartado silenciosamente. A operação retorna ajustes e nova cotação. O visitante consumido é marcado/rotacionado para que refresh ou login repetido não reapliquem o merge. Falha mantém ambos os carrinhos intactos e permite tentar o mesmo merge novamente.

Logout cria carrinho visitante novo/vazio; carrinho do usuário permanece apenas no servidor simulado para seu próximo login. Preço/estoque são consultados, não congelados na linha do carrinho. Item esgotado permanece identificável e removível, bloqueando checkout até ajuste. Cupom aplicado é parte do carrinho; mudança relevante revalida cotação.

### D08 Checkout, reserva e idempotência

Estado: edição/revisão → revalidação → enviando → pendente → confirmado ou recusado. Campos do perfil e seleção de carteira/rede são revisáveis antes do envio. Alteração de qualquer campo, linha, carteira, rede ou versão da cotação invalida a revisão aceita. Em mobile, o frame de carteiras é preservado e precedido, na mesma rota, por formulário/revisão derivados dos blocos desktop; navegação por passos é somente adaptação dos conteúdos obrigatórios.

Antes do POST, uma cotação REST nova deve corresponder ao resumo revisado. Diferença apresenta valores/itens afetados e exige novo clique explícito; um retry não conta como consentimento. POST cria pedido pendente e reserva estoque atomicamente, vinculado ao snapshot da cotação aceita. Chave aleatória é persistida **antes** do request e permanece a mesma para duplo clique, timeout, refresh, 401 seguido de login do mesmo usuário e reconexão da mesma tentativa. O request congelado não é reconstruído a partir do carrinho mutável durante recuperação.

Servidor consulta `(userId, idempotencyKey)` antes de qualquer nova validação/reserva. Mesmo hash de conteúdo recupera o pedido existente; hash diferente retorna 409. Pedido confirmado/recusado é terminal. Só uma tentativa explicitamente nova após recusa ou edição de um checkout ainda não enviado gera outra chave. Falha de rede após commit deixa o estado desconhecido e exige lookup/reenvio da mesma chave, nunca uma compra nova automática.

Em confirmação, o mock aplica uma única vez a baixa dos itens/quantidades comprados sobre os IDs de linha capturados. Quantidade adicionada durante a pendência permanece; linha removida e recriada tem novo ID e não é consumida por um pedido anterior. Em recusa, libera reserva e preserva o carrinho. Falhas prévias à criação não reservam nem removem itens. Snapshot inclui metadados, artes, preços, quantidades, desconto, taxa, total, carteira, rede e transação simulada, e não muda com o catálogo posterior.

### D09 MSW e Socket.IO no navegador

Transportes escolhidos: REST same-origin sob `/api/v1` via Axios e WebSocket-only sob `/socket.io/` com `socket.io-client`, namespace padrão, `upgrade=false`. MSW intercepta o WebSocket com `toSocketIo(connection)` de `@mswjs/socket.io-binding` 0.2.0. O handler usa a origem WebSocket, pois o MSW remove `/socket.io/` antes de comparar a URL. A API `SocketIo` inicialmente prevista não existe nessa versão publicada; a adaptação foi verificada em Chromium pela prova `tests/e2e/socket-probe.spec.ts`. Sem HTTP polling, namespaces customizados, callbacks de acknowledgement ou eventos binários. Esta decisão segue os limites documentados do binding e mantém um cliente Socket.IO real.

Após connect, o cliente envia evento de texto `session.bind` com token fictício ou visitorId e nonce da geração. O handler valida a sessão no mesmo repositório REST e responde com evento comum `session.ready` (não ack). Só então aceita `resources.subscribe` de NFTs/pedidos ativos, verificando proprietário dos pedidos. Recebimento e emissão de eventos passam pelo binding; teste/controlador nunca chama setters/cache da aplicação.

Envelope tem eventId, type, resourceId, version, occurredAt e payload; pedidos têm ownerUserId e targetSessionId. Cliente descarta eventId duplicado, versão <= conhecida, sessão/owner incompatíveis e tentativa de sair de estado terminal. Mantém até 1.000 eventIds, com versão por recurso protegendo contra repetição após expurgo. REST reconcilia recursos ativos após toda reconexão antes de habilitar confirmação; não há replay confiável presumido.

`nft.updated` invalida catálogo/detalhe/carrinho/cotação e informa a alteração; a versão pública do catálogo evita sobrescrita por listas antigas. `order.updated` atualiza apenas o pedido autorizado. Nenhum evento pode confirmar pedido sem estado correspondente na simulação REST; em conflito, REST prevalece e o estado terminal não regride. Cleanup remove listeners, subscriptions, timers e conexão no fim do ciclo/geração, inclusive React StrictMode.

Commits do mock registram um evento estável em outbox e notificam outras abas por BroadcastChannel. Cada handler de rede entrega os eventos às suas conexões Socket.IO autorizadas pelo binding; a UI nunca consome BroadcastChannel como substituto do transporte. GET/reconnect também recuperam a outbox/estado, pois mensagens entre abas podem ser perdidas. Transações coordenam concorrência no banco compartilhado, não apenas em flags de componente.

### D10 Cenários e relógio

Fixtures: 36 NFTs (nove por página, quatro páginas), usando somente as quatro artes locais e rótulos/categorias/redes do material, com preços/estoques/ratings/createdAt determinísticos; dois usuários fictícios isolados. Produtos adicionais são dados de mock necessários a filtros/paginação, não novas funcionalidades. Cenários visuais distintos reproduzem conteúdos desktop/mobile sem alterar dados ao redimensionar uma sessão.

Endpoint de controle MSW escolhe/reset cenário, avança relógio, altera NFT/taxa/cupom, finaliza pedido e injeta duplicata/ordem de eventos ou corte de transporte. A seleção é via configuração e, na demonstração, query técnica `mockScenario` consumida pelo bootstrap; não aparece como painel de implementação no fluxo do produto. O README documenta comandos e URLs reproduzíveis.

Relógio padrão nasce em 2026-07-29T12:00:00Z (data do recibo) e progride com tempo decorrido; testes e visuais usam modo manual. Pedidos têm resolução prevista persistida; timers executam quando a página está aberta, e GET/reconexão/bootstrap processam vencimentos após recarga. Não se promete processamento em background com navegador fechado. Cenários não dependem de esperas reais longas nem de aleatoriedade sem seed.

### D11 Interface e assets

Os 15 frames e os componentes descritos são a base de cada tela; `ui-reference-matrix.md` fecha dimensões, adaptações e desvios. Tailwind carrega tokens derivados das propriedades resolvidas. shadcn fornece Dialog, Sheet, Button, Input, Tabs, Checkbox, Select e feedback, com aparência modificada para o Figma. Ícones são vetores exatos do arquivo, não os ícones padrão da biblioteca.

Exportar SVGs via interface permitida do Figma/cópia ou fonte local importada; obter referências renderizadas limpas e fontes antes de codificar cada tela. Conferir slots, hashes, recorte, geometria e variante. Se um asset/propriedade não puder ser obtido, o gate visual permanece aberto: não trocar por um similar nem declarar a tela concluída. Isso é trabalho de aquisição especificado, não uma pergunta de produto em aberto.

Breakpoints de implementação: mobile <768, tablet 768–1279, desktop >=1280; em 1440, conteúdo de 1200 e margens de 120; no mobile de 414, medidas do frame. Em 390, recuos preservados e conteúdo fluido, sem escala global da fonte. Tablet usa componentes mobile em duas colunas quando couberem, com header compacto e drawers; form/tabela não perdem campos/ações. Detalhes de cada adaptação estão no registro de decisões.

Skeletons preservam as dimensões dos slots e shimmer respeita reduced motion. Foco visível, trap/restauração em diálogos, Escape, nomes de ícones, aria-live e erros por campo são parte da UI. Barras inferiores usam sticky no contêiner de página com espaço reservado e rolagem; reproduzem a posição nos frames sem cortar conteúdo com zoom/teclado.

### D12 Qualidade e publicação

Playwright observa UI e resultados REST/eventos reais da simulação. E2E em Chromium desktop/mobile, cenários isolados, clock/latência controlados, relatório HTML e trace em falha. Invariantes monetárias, idempotência, transações e ordenação recebem testes focados adicionais; não substituir E2E por chamadas a hooks.

Revisão visual com o Figma e regressão do app são verificações distintas: conferir os frames e registrar diferenças relevantes, e versionar baselines estáveis para home/detalhe/cart/pagamento. Não se exige igualdade pixel a pixel nem correção de diferenças pequenas de rasterização ou espaçamento para aprovar a entrega. Não mascarar defeitos funcionais ou conteúdo ausente. `verification.md` fornece a matriz, observado o critério atualizado acima.

Lighthouse usa build de demonstração otimizado, mocks padrão, imagens/fontes reais, início/detalhe, mobile/desktop, três execuções por combinação (12 totais), medianas das quatro categorias e LCP/CLS/TBT. Metas do README preservadas; abaixo da meta exige causa e justificativa, sem desligar funcionalidades para pontuar.

Deploy alvo: Vercel, hospedagem estática do build Vite, fallback de rotas preservando arquivos existentes e Service Worker. O gate público repete compra, refresh direto, cenários e eventos. Registrar commit, build/config, URL pública e repo. Hospedagem é tarefa de implementação/entrega; nenhum serviço é criado nesta proposta.

## Risks / Trade-offs

- [Dados do Figma incompatíveis entre telas] → Decisões explícitas de identidade/cotação e diff visual completo; nenhuma promessa de igualdade numérica com valores incorretos.
- [Quota/annotations indisponíveis] → Fonte `.fig` e cópia disponíveis, exportação UI e verificação de propriedades; não depender de permissões adicionais nem inventar instruções ocultas.
- [Binding recente e compatibilidade de interceptores] → Fixar dependências publicadas compatíveis e executar primeiro o gate de handshake, eventos e reconexão no build. Falha bloqueia avanço, não autoriza substituir Socket.IO por callbacks.
- [Estado local não é backend seguro] → Somente dados fictícios, isolamento testado por API e geração, sem credenciais reais nem exposição de serviços privados.
- [Múltiplas abas e timeout após commit] → Transações IDB, idempotência por usuário, reservas e ledger duráveis; conflitos de revisão produzem 409 com recuperação explícita.
- [Layout fixo do design e acessibilidade] → Reproduzir nos tamanhos de referência e adaptar expansão/scroll sem cortar conteúdo; alterações mínimas documentadas por componente.
- [Ordem/identidade de eventos não cobre perda de mensagens] → REST obrigatório após reconnect/foco/refresh; terminalidade e watermark impedem regressões.

## Migration Plan

Sem migração de dados produtivos. Preservar README original em `docs/challenge-brief.md`, criar aplicação e lockfile, adquirir referências/assets e provar transporte antes dos fluxos. Concluir os gates de `verification.md`, build otimizado e publicação do mesmo commit. Versionar schema/seed do mock; incompatibilidade de DB apresenta reset explícito, sem apagar estado silenciosamente. Publicação substitui uma URL de demonstração somente após validação; rollback aponta ao deployment anterior do mesmo projeto, com reset documentado se o schema local for incompatível. Nenhum usuário/dado real é migrado.

Referências técnicas consultadas em 2026-11-05: [binding Socket.IO e limites](https://github.com/mswjs/socket.io-binding), [MSW WebSocket](https://mswjs.io/docs/websocket/), [Socket.IO transportes](https://socket.io/docs/v4/client-options/#transports), [parâmetros de password hashing](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#pbkdf2). São suporte técnico às escolhas; não acrescentam escopo de produto.
