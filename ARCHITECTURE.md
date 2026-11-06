# Arquitetura — implementação em andamento

Este documento descreve a base existente, não uma entrega concluída. As telas e os fluxos principais estão implementados e há uma publicação do commit `d1810af`; a verificação integral dos gates permanece pendente. O enunciado preservado está em [docs/challenge-brief.md](docs/challenge-brief.md), e as decisões de implementação estão na mudança OpenSpec local.

## Inicialização e rede

`src/main.tsx` inicia o MSW quando `VITE_ENABLE_MOCKS=true`, recupera a sessão simulada e inicia a sincronização antes de montar os provedores Query e Router. A API Axios usa `/api/v1` e timeout de 10 segundos. Os handlers em `src/mocks` implementam as respostas REST e persistem o estado em IndexedDB; clientes em `src/shared` chamam a rede e validam respostas com os schemas de `contracts.ts`. O controle de cenários, latência e falhas também fica na camada de mocks.

O banco simulado mantém catálogo, usuários, sessões, carrinhos, cotações, carteiras, pedidos e registros auxiliares. Nos resets dos cenários visuais, o carrinho é criado atomicamente para o visitante da nova geração, preservando a fixture mesmo quando uma tentativa anterior termina atrasada. Mutações relacionadas usam transações IndexedDB. Uma falha no banco não é apresentada como uma persistência bem-sucedida em memória. Os dados de demonstração e o serviço não representam operações reais de blockchain ou de pagamento.

Os contratos completos de rotas, campos, erros e cenários estão em [contracts.md](openspec/changes/implement-nft-marketplace-challenge/contracts.md). As operações principais são:

| Recurso | Operações |
| --- | --- |
| Sessão | `POST /auth/signup`, `POST /auth/login`, `GET /auth/session` e `POST /auth/logout`. |
| Catálogo e favoritos | `GET /nfts`, `GET /nfts/:id`, `GET /favorites` e `PUT`/`DELETE /favorites/:nftId`. |
| Carrinho e cotação | `GET /cart`, mutações em `/cart/items` e `/cart/coupon`, `POST /cart/merge` e `POST /quotes`. |
| Conta | `GET`/`PUT /profile`, `GET /profile/avatar`, `GET /wallets`, `PUT /wallets/:slot` e operações em `/wallet-connections`. |
| Pedidos | `POST /orders`, `GET /orders/attempts/:key` e `GET /orders/:id`. |

Todas as rotas têm prefixo `/api/v1`. Dados privados usam token fictício, e o carrinho visitante usa identificador próprio. Revisões usam `If-Match`; inclusão no carrinho e criação de pedido usam chaves de idempotência. Valores em ETH trafegam como strings decimais. Erros incluem código, mensagem, campos opcionais, indicação de retry e identificador da requisição.

## Sessão e isolamento

`SessionManager` recupera a sessão pelo token simulado e associa consultas privadas ao proprietário e à geração da sessão. Respostas atrasadas são verificadas antes de alcançar o cache. O interceptor trata 401 da sessão atual; logout e troca de conta limpam dados privados e rascunhos conforme o fluxo. Na expiração, o rascunho e a tentativa pertencentes ao mesmo usuário podem ser preservados para recuperação; logout os remove.

No logout, a sessão local é limpa antes da tentativa de revogação no servidor simulado. Se a chamada falha, um aviso informa que a revogação não foi confirmada; uma resposta atrasada não redireciona nem adverte uma sessão nova. A falha não prova que o token anterior foi revogado no repositório simulado.

Autenticação e merge do carrinho são operações distintas: se o login funciona e o merge falha, a sessão permanece ativa e o identificador do visitante é conservado para retry. O merge no repositório é idempotente, e o visitante é rotacionado após resposta válida.

## Carrinho e pedidos

O carrinho usa identidade de visitante ou usuário, revisão e IDs de linha. Os valores monetários são calculados em wei inteiro, sem ponto flutuante. A cotação identifica revisão, versões do catálogo, itens, desconto e taxa; o cliente valida esses dados e descarta respostas mais antigas do que o estado observado. Alterações relevantes ou expiração exigem nova revisão antes de criar o pedido.

`OrderAttemptManager` grava chave e payload congelado antes do POST. Timeout e expiração de sessão permitem recuperar ou reenviar a mesma tentativa pelo mesmo proprietário. O repositório simulado aplica idempotência e reserva estoque transacionalmente; confirmação e recusa são estados simulados. A interface apresenta estados pendente e recusado e um recibo do snapshot confirmado. A revisão visual do recibo e suas limitações estão em [docs/visual-verification/revisao.md](docs/visual-verification/revisao.md).

## Cache e tempo real

TanStack Query usa chaves com parâmetros normalizados e, em recursos privados, usuário e geração. Catálogo e detalhe usam `staleTime` de 30 segundos; carrinho, pedido e cotação usam zero. O cache usa `gcTime` de cinco minutos. GETs têm até duas tentativas adicionais para falhas de rede ou 5xx, com atrasos de 250 e 500 ms; falhas 4xx e cancelamentos não são repetidos. Respostas de catálogo ou detalhe rejeitadas como obsoletas pelo controle de versão ou por troca de sessão também são consultadas novamente, com o mesmo limite, sem aplicar o resultado antigo. Mutações não recebem retry automático. A cotação usa POST e não é repetida automaticamente.

O cliente Socket.IO conecta por WebSocket, vincula a identidade e assina recursos ativos. O outbox propaga eventos entre abas. `EventGate` valida identidade, deduplica eventos e mantém marcas de versão; eventos invalidam consultas, e o REST autoritativo determina o estado do pedido. Reconexão e retorno de foco suspendem a prontidão enquanto os recursos ativos são reconciliados. O runtime remove seus listeners ao parar.

O cliente envia `session.bind` e `resources.subscribe`; recebe `session.ready` e `resources.subscribed` antes de tratar os recursos. `nft.updated` identifica NFT e versão de catálogo; `order.updated` inclui proprietário, sessão de destino, pedido e estado. Eventos duplicados, antigos ou de outra sessão não devem sobrepor o estado aceito. O transporte é simulado pelo MSW no navegador: não há servidor Socket.IO externo, replay confiável após desconexão nem garantia de segurança equivalente a um backend real.

## Divergências visuais identificadas

Na home mobile (F10), o quarto card do frame mostra uma imagem diferente daquela associada ao nome repetido na camada. A implementação mantém a arte canônica do NFT exibido em todos os tamanhos, conforme a decisão C04; esse ponto está registrado na revisão visual.

As cores originais do texto do hero mobile foram mantidas por decisão do usuário. A medição sobre o gradiente ficou abaixo de 4,5:1 em 320, 390 e 414 px; em larguras menores que 414 px, a imagem é redimensionada para não cobrir a descrição. O método e os limites da verificação estão em [reports/accessibility/README.md](reports/accessibility/README.md).

No detalhe mobile (F11), o primeiro chip usa `1/1` em vez da repetição de `1/10` do frame (C03). No carrinho mobile (F12), o subtotal e o total vêm da cotação correta: 8.14 e 8.156 ETH para a fixture, contra 8.92 e 8.936 ETH no desenho (C01). A remoção fica disponível no canto superior direito de cada card, separada do seletor de quantidade (C10). As artes desse frame usam uma segunda camada da mesma imagem com mesclagem `MULTIPLY`, como nos nós originais. A revisão das referências F01–F15 está documentada; ela não aprova automaticamente o gate visual e de acessibilidade.

As decisões C01–C12, L01–L27 e V01–V11, incluindo adaptações sem frame e ações fora do escopo, estão detalhadas em [decisions.md](openspec/changes/implement-nft-marketplace-challenge/decisions.md). Sua relação com requisitos e tarefas está em [traceability.md](openspec/changes/implement-nft-marketplace-challenge/traceability.md); a [revisão visual](docs/visual-verification/revisao.md) registra diferenças observadas por frame. A [revisão de arquitetura](docs/architecture-review.md) aponta implementação e testes relacionados a cada grupo de decisões, com os limites da evidência. A documentação dessas decisões não comprova, por si só, que todas já foram verificadas na versão final.

## Pendências de entrega

Faltam concluir a cobertura de aceitação de ponta a ponta, o gate visual e de acessibilidade e a auditoria da entrega. A [publicação e suas verificações parciais](docs/delivery-verification.md) identificam a URL e o commit publicado; alterações locais posteriores ainda não integram esse deployment. As 12 medições Lighthouse locais e seus limites estão em [reports/lighthouse/README.md](reports/lighthouse/README.md); não comprovam a versão publicada. As decisões e desvios precisam ser revisados contra a implementação final antes de considerar este documento e a tarefa de documentação completos.
