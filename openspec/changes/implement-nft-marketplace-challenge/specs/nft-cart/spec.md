## Purpose

Manter carrinho consistente por proprietário, quantidades e cupons, com persistência e totais precisos da cotação.

## ADDED Requirements

### Requirement: NC01 Edição de linhas e limites

Adicionar, alterar e remover MUST respeitar NFT/edição, quantidade inteira e estoque. Todas as linhas MUST permitir remoção. Esgotamento posterior MUST manter item identificável/removível e bloquear checkout até ajuste.

#### Scenario: Estoque excedido
- **WHEN** usuário tenta adicionar ou aumentar além do disponível
- **THEN** API rejeita sem mudança parcial e interface informa limite, preservando carrinho válido.

### Requirement: NC02 Persistência e merge

Carrinho visitante/usuário MUST persistir após refresh. Autenticação MUST mesclar visitante ao usuário exatamente uma vez, informando ajustes de estoque. Falha MUST preservar ambos para retry da mesma operação.

#### Scenario: Login repetido após merge
- **WHEN** usuário autentica com itens visitantes, recarrega e repete fluxo
- **THEN** itens visitantes não são somados novamente e nenhum item é perdido silenciosamente.

### Requirement: NC03 Cupom e totais precisos

Aplicar/remover cupom MUST recalcular subtotal, desconto, taxa e total pela API. Inválido/expirado MUST produzir erro. Valores ETH MUST trafegar como strings decimais e manter precisão até 18 casas sem float; quantidades MUST ser inteiras.

#### Scenario: Cotação mobile corrigida
- **WHEN** fixture mobile contém linhas 1.19, 1.39, 3.58, 1.98 e taxa 0.016 sem desconto
- **THEN** subtotal 8.14 e total 8.156 são apresentados, independentemente dos números ilustrativos inconsistentes.

### Requirement: NC04 Alterações durante navegação

Preço/disponibilidade recebidos em tempo real MUST atualizar linhas/resumo e informar alteração. Cotação atual da API MUST reger checkout, não preço guardado no componente.

#### Scenario: NFT alterado com cart aberto
- **WHEN** simulação muda preço ou estoque do NFT
- **THEN** interface informa a mudança, reconcilia o resumo e não permite confirmar cotação antiga.

### Requirement: NC05 Estado e contagem coerentes

Badge MUST representar soma das quantidades e vazio MUST fornecer retorno ao catálogo. Dados de carrinho MUST NOT variar por breakpoint nem copiar carrinho privado no logout.

#### Scenario: Resize e saída
- **WHEN** usuário alterna desktop/mobile e faz logout
- **THEN** resize conserva os dados e logout abre contexto visitante separado, sem revelar cart privado.
