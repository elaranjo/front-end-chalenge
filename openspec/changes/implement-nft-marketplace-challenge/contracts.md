# Contratos da simulação

Este contrato integra a change. Base `/api/v1`, JSON UTF-8, Axios; datas ISO UTC. Requests privados usam `Authorization: Bearer <token fictício>`. Visitantes usam `X-Visitor-Id` opaco criado no bootstrap. Não aceitar ownerId arbitrário como autorização. Respostas privadas somente do proprietário; IDs alheios conhecidos retornam 403. Campos inválidos retornam 422. Mutations com revisão usam `If-Match` da revisão recebida (409 em conflito). Senhas transitam somente para handlers de autenticação/alteração e nunca voltam em responses.

## Tipos e invariantes

- `Money`: string decimal não negativa, até 18 casas, sem expoente/sinal/separador de milhar. Normalizar zero como `0`, separar apresentação pt-BR do transporte. Cálculo inteiro em wei. `quantity` inteiro >=1; estoque inteiro >=0; esgotado conserva item e bloqueia compra.
- `Error`: `{error:{code,message,fieldErrors?:Record<string,string>,retryable:boolean},requestId}`. Status 400 request ilegível, 401 sessão inválida/expirada, 403 owner indevido, 404 ausente, 409 versão/estoque/idempotência/conflito de conta, 422 validação, 500/503 transitório. Falha de rede e timeout não são convertidos em erro de negócio ou sucesso.
- `Version`: inteiro monotônico por recurso; catálogo tem `catalogVersion`; carrinho `revision`. Respostas antigas não podem substituir novas. `Page<T>`: `{items,total,page,pageSize:9,hasNext,catalogVersion,facets}`.
- `NFT`: `{id,tokenId,name,category,network,collection,attributes,artUrl,gallery:[{id,url,alt}],description,rating,ratingCount,createdAt,version,editions:[{id,label,unitPrice,available,version}]}`. Slugs de rede `ethereum|polygon|solana`; edição `one-of-one|one-of-ten|one-of-fifty|open`. Galeria pode repetir imagem existente como no frame.
- `Profile`: `{id,displayName,username,email,ensName,walletNickname,avatarUrl,version}`. `Wallet`: `{id,slot:primary|secondary,displayName,nickname,network,profileName,address,secondaryAddress?,type,referralCode,email,ensName,version}`. Tipo `walletconnect|metamask|coinbase` representa provedor simulado; não marca suportes de blockchain reais.
- `Cart`: `{id,ownerKind,revision,catalogVersion,lines:[{lineId,nftId,editionId,quantity,nft,unitPrice,available}],couponCode,quote,adjustments}`. Remover e readicionar gera outro lineId. Totais da API são a referência. Reserva de um pedido não invalida os preços históricos do pedido.
- `Quote`: `{id,cartId,cartRevision,catalogVersion,lines:[{lineId,nftId,editionId,nftVersion,editionVersion,quantity,unitPrice,lineTotal}],coupon:{code,version}|null,subtotal,discount,networkFee,total,network,expiresAt,fingerprint}`. TTL 60 segundos no relógio do cenário; desconto <=subtotal, total=subtotal-desconto+taxa. Mudança de qualquer componente invalida fingerprint/revisão aceita. Cotação não reserva estoque.
- `CheckoutDraft`: somente campos do formulário desenhado, walletId, provider, network, useOtherWallet, note opcional. `Order`: `{id,version,ownerUserId,status:pending|confirmed|declined,createdAt,updatedAt,snapshot,transaction?:{id,network,simulated:true},declineReason?}`. Snapshot contém linhas com nome/token/arte/edição/quantidade/preços, totais, dados do colecionador, carteira/endereço/provedor/rede e cotação aceita. Imutável; transação gerada só quando confirmado.

## Operações REST

| Método e rota | Entrada | Saída / efeito |
| --- | --- | --- |
| POST `/auth/signup` | username,email,password,passwordConfirmation | 201 session+profile; 409 email/username usado; não exige carteira. |
| POST `/auth/login` | email,password | 200 `{token,sessionId,userId,expiresAt,profile}`; 401 inválido. |
| GET `/auth/session` | token | Sessão recuperável; 401 expirado; validade 30 minutos. |
| POST `/auth/logout` | token | 204, revoga sessão e suas conexões. |
| GET `/nfts` | q,category[],network[],min,max,sort,page,tab | Page<NFT>; OR na mesma dimensão, AND entre dimensões, faixa inclusiva. |
| GET `/nfts/:id` | ID | NFT ou 404. |
| GET `/favorites` | sessão | `{items:NFT[],version}` proprietário. |
| PUT / DELETE `/favorites/:nftId` | sessão | Inclusão/remoção idempotente, 200 estado/versão. |
| GET `/cart` | sessão ou visitorId | Cart+cotação atual. |
| POST `/cart/items` | nftId,editionId,quantity + If-Match | 200 Cart; soma à linha existente até limite, rejeita excesso 409 sem commit parcial. |
| PATCH `/cart/items/:lineId` | quantity + If-Match | 200 Cart; 409 excesso/revisão. |
| DELETE `/cart/items/:lineId` | If-Match | 200 Cart; ausente já removido retorna Cart sem novo efeito. |
| PUT / DELETE `/cart/coupon` | code no PUT + If-Match | 200 Cart com quote; 422 inválido/expirado, preserva anterior. |
| POST `/cart/merge` | visitorId,mergeKey (estável por visitante consumido) | Privada, soma/capa ao estoque, retorna ajustes; commit único e visitante consumido. Falha sem perda, repetição recupera resultado. |
| POST `/quotes` | cartRevision,walletId,network,provider | Privada, 200 cotação atual; 409 revisão/estoque, 422 seleção inválida. Aceita cupom do carrinho. |
| GET `/profile` | sessão | Profile. |
| PUT `/profile` | campos, avatar staged ou null, optional passwordChange + If-Match | Commit atômico e retorno Profile; senha incorreta/arquivo inválido não altera nada. |
| GET `/profile/avatar` | sessão | Blob atual ou 404; URLs locais obtidas via fetch autenticado e revogadas no cleanup. |
| GET `/wallets` | sessão | `{items:Wallet[],version}` no máximo dois slots. |
| PUT `/wallets/:slot` | campos + If-Match | 200 wallet/lista; validação sem cadastro parcial. |
| POST `/wallet-connections` | walletId,provider,network | `{id,status:connected|refused,walletId,network,version}` depois da latência configurada; só seleção salva do owner. |
| DELETE `/wallet-connections/:id` | sessão | 204 desconecta; troca de carteira invalida conexão/revisão. |
| POST `/orders` | `Idempotency-Key`, quoteId,quoteFingerprint,cartRevision,collector,walletId,provider,network,connectionId | 201 novo pending ou 200 pedido já registrado. Mesmo owner+key+conteúdo recupera mesmo pedido antes de revalidar quote. Conteúdo diferente 409. |
| GET `/orders/attempts/:key` | sessão | Mesmo pedido da tentativa ou 404 se não registrado; nunca retorna pedido de outro owner. |
| GET `/orders/:id` | sessão | Estado/recibo do owner; processa resolução vencida antes de responder. |

PUT profile usa multipart para arquivo opcional e JSON de campos/senha; hashes/Blobs persistem somente após toda validação. Limite 2 MiB e MIME real PNG/JPEG/WebP. Não retornar senha/hash. Endpoints que não estão nesta tabela não são necessários aos fluxos: social/forgot/newsletter não fingem integração.

POST de inclusão no carrinho recebe `X-Mutation-Id` persistido pela operação: replay do mesmo owner/chave/payload retorna resultado sem incrementar de novo; payload diferente retorna 409. Atualizações absolutas/remoções/favoritos já são idempotentes. Falha ambígua de mutation requer consulta do recurso antes de nova ação; não há retry automático. POST de conexão reutiliza conexão ativa da mesma combinação owner/carteira/rede/provedor, desconectando a seleção anterior na troca. Versões e atualizações de outras abas são reconciliadas via rede e outbox descrita em D09.

## Regras de campos

Textos obrigatórios: trim não vazio. Email sintaticamente válido; username/email únicos case-insensitive; sem novas restrições de complexidade. Signup senha não vazia e confirmação igual. Profile: dados desenhados obrigatórios, ENS/nickname opcionais se sem asterisco; bloco senha em branco mantém senha, qualquer campo preenchido exige os três, atual correta e confirmação igual. ENS informado é label fictício alfanumérico/hífen com `.eth` separado pelo seletor; não valida propriedade real. Endereço de carteira é `0x` + 40 hex como formato demonstrativo para todas as redes do mock, não validador blockchain. Campos com asterisco em checkout/carteiras obrigatórios, inclusive indicação/ENS, aceitando dados fictícios. Campo “ENS ou carteira secundária” e observação opcionais. Tipo/rede somente enums. Rede da conexão deve corresponder à carteira; selecionar outra rede exige selecionar/editar carteira correspondente, não migrar saldo. Usar outra carteira abre escolha de carteira cadastrada ou link `/wallets?returnTo=/checkout`; não cria carteira temporária oculta. Code inválido retorna fieldErrors; nenhum erro exige conta ENS/indicação real.

## Consistência e recuperação de pedido

Antes de enviar, validar campos, conexão, carteira/rede e cotação nova. Se fingerprint mudou, mostrar diferenças e obter aceite explícito novo. Request e chave são gravados antes de POST. Em rejeição explícita anterior ao commit (422/409 stale quote), pode corrigir e iniciar tentativa nova; em rede/timeout/5xx sem certeza de commit, lookup/reenvio **da mesma chave e conteúdo**. Atualização do draft não altera payload de tentativa desconhecida. Quando um pedido já existe, validade atual de quote/carrinho não bloqueia sua recuperação.

Criação pendente reserva estoque e salva snapshot/chave atomicamente. Confirmar aplica reserva/baixa e consumo do carrinho em transação e ledger únicos; declinar libera reserva e preserva linhas. Consumir apenas lineIds capturados, até quantidade comprada, conservando acréscimos posteriores e linhas recriadas. Estados terminais nunca transitam de novo, inclusive com duas abas e eventos repetidos. Somente resposta confirmada do mock autoriza recibo. Novos preços, avatar, nome ou carteira não mudam snapshot antigo.

## Eventos e controle de cenários

WebSocket-only Socket.IO default namespace, sem polling, ack callbacks ou binários. `session.bind {token?|visitorId?,nonce}` → `session.ready {sessionId,nonce}`; falha → `session.rejected` e invalida privado. `resources.subscribe {catalog:boolean,nftIds,orderIds}` substitui conjunto autorizado da conexão; unsubscribe/cleanup liberam o conjunto. Home ativa assina catálogo público para invalidar resultados/facets mesmo quando o NFT alterado está fora da página atual; detalhe/carrinho assinam IDs pertinentes e pedidos exigem owner. Reconexão exige novo bind e reconciliação REST antes de confirmar checkout.

`nft.updated` envelope `{eventId,type,resourceId,version,catalogVersion,occurredAt,payload:{nftId,editions}}`; `order.updated` inclui `{ownerUserId,targetSessionId,payload:{orderId,status}}`. Identidade estável em redelivery. Eventos antigos/duplicados/owner ou geração errados são descartados. Payload dispara reconciliação; não altera pedido para sucesso se o repositório REST não estiver confirmado.

Controles técnicos MSW: POST `/__mock/reset {scenario,clockMode,seed}`, GET `/__mock/state` (metadados sem hashes/senhas), POST `/__mock/clock {advanceMs}`, POST `/__mock/actions {action,payload}`. Ações: updateNft, updateFee, expireCoupon, expireSession, resolveOrder, disconnect, emitDuplicate, emitOlder e setWalletConnectionBehavior `{refuse:boolean}` para reproduzir a recusa de conexão prevista em L17. Alterações normais escrevem o mesmo DB REST e emitem pelo binding; injeções duplicada/antiga são exceções de teste sem regressão do DB. Controles disponíveis somente com mocks configurados; sem painel novo na UI. Reset inclui DB/sessões/carrinhos/ledger/drafts/cache/subscriptions e força nova geração.

Seed 36 NFTs, duas contas, quatro artes originais, quatro páginas de nove; categorias e redes abrangem todos os filtros. Credenciais exclusivamente fictícias documentadas no README: `colecionador.a@kurio.test` / `DemoA!2026` e `colecionador.b@kurio.test` / `DemoB!2026`; armazenar hashes precomputados, não senhas do seed no DB. Cupom `KURIO10` desconta 10% do subtotal com truncamento em wei; `EXPIRADO` recusa por validade; demais códigos inválidos. Não há novo programa de benefícios: são fixtures do cupom já exigido.

Cenários determinísticos: default, visual-desktop, visual-mobile, empty, slow, out-of-order, network-error, http-400/401/403/404/409/422/500/503, session-expired, signup-conflict, validation-errors, favorite-failure, coupon-invalid, coupon-expired, price-change, sold-out, fee-change, timeout-after-order-create, payment-confirmed, payment-declined, pending-disconnect, duplicate-old-events. Cada um define seed/latência/trigger/resultado; seleção não muda ao redimensionar. Latência default 200 ms, slow 2 s; out-of-order primeiro request 800 ms e segundo 100 ms; default pending 2 s até confirmed; declined equivalente. Timeout-after-order-create salva antes de omitir resposta por mais de 10 s; relógio manual permite resolver sem esperar tempo real.
