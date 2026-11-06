## Purpose

Disponibilizar uma simulação de rede reproduzível e persistente para todos os recursos e cenários exigidos.

## ADDED Requirements

### Requirement: MN01 Contratos de recursos e erros

Simulação MUST oferecer todos os recursos REST de contracts.md com contratos tipados e erros de validação, sessão, permissão, ausência, conflito e falha transitória. Interface MUST usar a rede sem respostas fictícias embutidas em componentes/hooks.

#### Scenario: Falha controlada da API
- **WHEN** handler responde 422, 401, 403, 404, 409 ou 503
- **THEN** interface representa erro correspondente e oferece recuperação adequada sem caminho alternativo de negócio.

### Requirement: MN02 Estado compartilhado e persistência

REST e eventos MUST usar o mesmo estado consistente de catálogo, sessão, favoritos, cart, quote, perfil, carteiras e pedidos. Refresh MUST conservar commits; reset MUST restaurar todas as entidades e eliminar efeitos anteriores.

#### Scenario: Reset após compra
- **WHEN** cenário é resetado depois de alterações e pedido confirmado
- **THEN** estoques/carts/pedidos/sessões/ledger/drafts retornam integralmente ao seed conhecido sem evento antigo contaminar nova geração.

### Requirement: MN03 Cenários determinísticos e fixtures

Fixtures MUST conter pelo menos dois usuários e variedade para filtros/paginação. Todos os cenários listados em contracts.md MUST ser configuráveis/reproduzíveis, incluindo slow/out-of-order/rede e HTTP 4xx/5xx/expiração/conflito/cupom/preço/estoque/timeout após commit/confirmed/declined.

#### Scenario: Reprodução de timeout e vazio
- **WHEN** avaliador escolhe cenários documentados e reseta
- **THEN** cada execução reproduz condições/resultado previstos sem aleatoriedade não controlada.

### Requirement: MN04 Mocks no build de demonstração

Ativação MUST ser por configuração, funcionar em desenvolvimento/testes/build público e inicializar antes das chamadas. Falha de inicialização MUST mostrar erro recuperável e MUST NOT apresentar sucesso em memória sem persistência.

#### Scenario: Abertura pública direta
- **WHEN** aplicação publicada abre rota profunda com mocks habilitados
- **THEN** recursos REST/eventos funcionam sem backend privado e refresh recupera estado.

### Requirement: MN05 Eventos via protocolo real

Eventos simulados MUST passar por cliente Socket.IO efetivo e interceptação de rede compatível. Controles de teste MUST NOT chamar setters, callbacks ou cache da interface para imitar eventos.

#### Scenario: Mudança de dados
- **WHEN** controle técnico altera NFT ou pedido no mock
- **THEN** DB/REST refletem alteração e evento chega pelo transporte Socket.IO ao cliente.
