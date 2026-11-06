## Purpose

Permitir descoberta e seleção consistente de NFTs, com consultas navegáveis, detalhe direto, galeria e favoritos persistentes.

## ADDED Requirements

### Requirement: CD01 Consulta refletida na URL

Busca, filtros combináveis, ordenação, aba e página MUST compor a URL, sobreviver a refresh/back/forward e produzir parâmetros equivalentes na API. Mudança de filtro/busca/ordenação/aba MUST reiniciar página 1; parâmetros inválidos MUST ser normalizados.

#### Scenario: Histórico e combinação
- **WHEN** usuário combina categorias/redes/faixa, ordena, vai à página 2 e usa back/refresh
- **THEN** URL, controles e resultados recuperam os mesmos parâmetros sem estado paralelo contraditório.

### Requirement: CD02 Ordenação e paginação consistentes

Resultados MUST usar OR dentro de categorias/redes, AND entre dimensões e faixa inclusiva. Ordenações e nove itens por página MUST seguir D05/L06/L07, com ordenação estável por ID nos empates, total e controles derivados da resposta.

#### Scenario: Paginação após filtro
- **WHEN** há mais de nove resultados e um filtro reduz o conjunto
- **THEN** páginas e total refletem o novo conjunto, começando na primeira página, em qualquer viewport.

### Requirement: CD03 Resultados atuais e estados remotos

Resultado de consulta obsoleta MUST NOT substituir consulta mais recente ou versão mais nova. Vazio/erro/retry MUST conservar filtros e permitir recuperação.

#### Scenario: Resposta fora de ordem
- **WHEN** busca anterior responde depois da busca atual ou de evento de catálogo mais novo
- **THEN** somente o conjunto/versão atual permanece exibido.

### Requirement: CD04 Detalhe e disponibilidade

Detalhe MUST permitir acesso direto, representar NFT inexistente, mostrar identidade/galeria/metadados e validar seleção de edição e quantidade inteira dentro do estoque. Edição indisponível MUST impedir adição/compra.

#### Scenario: Limite e ausência
- **WHEN** usuário abre ID inexistente ou tenta comprar edição esgotada/excedente
- **THEN** recebe estado correto e nenhuma linha/pedido inválido é criado.

### Requirement: CD05 Galeria e CTAs

Galeria e zoom MUST operar conforme L09; Comprar MUST incluir seleção e navegar ao carrinho após sucesso; Adicionar MUST incluir e permanecer no detalhe. Falha MUST preservar contexto e não apresentar sucesso.

#### Scenario: Compra da edição selecionada
- **WHEN** usuário escolhe edição/quantidade e clica Comprar
- **THEN** o carrinho recebe exatamente a seleção confirmada pela API e a navegação ocorre só após sucesso.

### Requirement: CD06 Favoritos privados com recuperação

Favoritos MUST exigir sessão, persistir por usuário e disponibilizar lista consultável. A interação MUST ser otimista com rollback em falha, sem reverter operação posterior ou contaminar outra sessão.

#### Scenario: Falha e troca de usuário
- **WHEN** favoritar falha ou responde após logout/login de outra conta
- **THEN** rollback restaura somente a operação pertinente e nenhum favorito da conta anterior aparece na nova.
