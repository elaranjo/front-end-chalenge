## Purpose

Sincronizar recursos com eventos versionados e reconciliação REST sem regressão, duplicação ou mistura de sessões.

## ADDED Requirements

### Requirement: RR01 Eventos identificados e versionados

nft.updated e order.updated MUST carregar eventId estável, recurso, versão e contexto autorizado. Cliente MUST descartar duplicatas, versões antigas e transições que saiam de terminal.

#### Scenario: Evento repetido/antigo
- **WHEN** mesmo eventId é reenviado ou versão inferior chega após a atual
- **THEN** estado não regride e estoque/carrinho/efeitos não são reaplicados.

### Requirement: RR02 Atualização dos recursos ativos

nft.updated MUST reconciliar catálogo/detalhe/cart/quote e informar mudança. order.updated MUST refletir pending/confirmed/declined somente do pedido autorizado cujo estado existe na simulação autoritativa.

#### Scenario: Preço durante checkout
- **WHEN** evento atual chega com NFT no cart
- **THEN** resumo atualiza e revisão antiga é invalidada antes de qualquer compra.

### Requirement: RR03 Reconexão por REST

Toda reconexão MUST reconciliar recursos ativos pela API antes de permitir confirmação. Evento perdido MUST NOT impedir recuperação de pedido ou deixar quote obsoleta habilitada.

#### Scenario: Perda de evento terminal
- **WHEN** pedido confirma enquanto socket está desconectado
- **THEN** reconexão consulta REST e apresenta recibo do mesmo pedido sem criar outro.

### Requirement: RR04 Ciclo de vida e sessão

Conexão/subscriptions MUST verificar sessão/owner e limpar listeners/timers no encerramento. Eventos/respostas da geração anterior MUST NOT atualizar usuário atual; subscribe alheio MUST ser recusado.

#### Scenario: Troca de conta com evento atrasado
- **WHEN** A encerra sessão e B entra antes de evento de pedido A chegar
- **THEN** B não recebe dados nem efeitos de A e nova conexão só aceita recursos autorizados.

### Requirement: RR05 Concorrência REST e evento

Resposta REST calculada antes de evento mais novo MUST NOT sobrescrever recurso/lista atual. Estado terminal MUST permanecer consistente com o repositório autoritativo.

#### Scenario: GET antigo após evento
- **WHEN** GET de cart/catálogo/pedido atrasado chega depois da versão atual
- **THEN** versão mais recente permanece e nova reconciliação é feita se necessária.
