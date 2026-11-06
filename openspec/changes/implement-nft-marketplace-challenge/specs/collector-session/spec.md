## Purpose

Garantir cadastro, autenticação recuperável e retomada dos fluxos privados sem exposição de dados entre sessões.

## ADDED Requirements

### Requirement: CS01 Cadastro e login validados

Cadastro/login MUST usar API simulada, validar os campos desenhados e tratar credenciais inválidas, erros por campo e conflito de email/username. Senhas MUST NOT ser persistidas em claro ou devolvidas em respostas.

#### Scenario: Conflito de cadastro
- **WHEN** usuário envia email/username já cadastrado ou senha divergente da confirmação
- **THEN** cadastro não é criado e erros identificam os campos sem perda dos dados não sensíveis.

### Requirement: CS02 Rotas privadas e retorno seguro

Checkout, perfil, carteiras, favoritos e pedidos MUST exigir autenticação. Login/cadastro bem-sucedido MUST retornar ao contexto anterior com URL/filtros/draft seguros preservados. returnTo externo MUST ser rejeitado.

#### Scenario: Acesso direto privado
- **WHEN** visitante abre checkout por URL e autentica
- **THEN** retorna ao checkout com seu carrinho/contexto, sem depender de histórico anterior.

### Requirement: CS03 Sessão recuperada e expirada

Sessão MUST ser recuperável após refresh e expirar segundo API/relógio do cenário. Expiração MUST suspender dados privados e permitir retomada pelo mesmo usuário sem reenviar compra com chave nova.

#### Scenario: Expiração no checkout
- **WHEN** token expira durante uma tentativa de pedido desconhecida e o mesmo usuário autentica
- **THEN** consulta/reenvio usa a chave e payload originais, recuperando pedido sem duplicação.

### Requirement: CS04 Logout e isolamento

Logout/troca de usuário MUST invalidar caches, requests, subscriptions e drafts privados anteriores, inclusive respostas/eventos atrasados. Carrinho privado MUST NOT ser exposto ao visitante seguinte.

#### Scenario: Resposta de A após login de B
- **WHEN** request/evento de A chega depois que B assume sessão
- **THEN** UI e caches de B não recebem nenhum dado ou efeito de A.

### Requirement: CS05 Navegação de autenticação

Auth desktop MUST usar os modais e fundo fornecidos; mobile MUST usar páginas integrais. Alternar login/cadastro e fechar/voltar MUST preservar retorno seguro, sem reter senhas no histórico/drafts.

#### Scenario: Fechar auth direto
- **WHEN** login foi aberto sem histórico válido e é fechado
- **THEN** home é usada como fallback e nenhuma tela privada fica visível ao visitante.
