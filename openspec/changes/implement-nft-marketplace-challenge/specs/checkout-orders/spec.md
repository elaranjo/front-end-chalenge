## Purpose

Concluir compras simuladas com revisão explícita, idempotência e recuperação, mantendo recibos imutáveis e efeitos únicos.

## ADDED Requirements

### Requirement: CO01 Dados e revisão completos

Checkout MUST validar todos os campos desenhados e permitir revisão de dados, itens, desconto, taxa e total antes do envio, inclusive mobile por L03. Revisão aceita MUST ser invalidada por alterações relevantes.

#### Scenario: Checkout mobile
- **WHEN** usuário percorre Dados e revisão e Carteira e rede
- **THEN** pode consultar e corrigir todos os dados/itens/totais antes da confirmação, sem campos omitidos.

### Requirement: CO02 Carteira e rede simuladas

Checkout MUST usar carteiras cadastradas do owner e simular conexão, recusa, desconexão e troca. Rede/provedor/conexão MUST ser validados e pedido MUST NOT ser enviado desconectado.

#### Scenario: Conexão recusada
- **WHEN** simulação recusa ou desconecta carteira
- **THEN** checkout informa estado, conserva draft e não cria pedido até nova conexão válida.

### Requirement: CO03 Cotação fresca e reconfirmação

Antes da criação, preço, estoque, cupom e taxa MUST ser revalidados na API. Mudança/expiração MUST exigir revisão e novo aceite explícito; nenhuma operação automática pode aceitar novos valores.

#### Scenario: Mudança entre revisão e envio
- **WHEN** preço/taxa/cupom/estoque muda ou cotação expira
- **THEN** pedido não é criado com o aceite antigo e diferenças são exibidas para nova confirmação.

### Requirement: CO04 Criação idempotente

Cada tentativa MUST aceitar chave de idempotência persistida antes do envio. Mesmo owner/chave/conteúdo MUST recuperar mesmo pedido antes de revalidar estado atual; conteúdo diferente MUST gerar 409. Cliques/reenvios concorrentes MUST NOT reservar ou criar duas vezes.

#### Scenario: Timeout após commit
- **WHEN** API cria pedido mas resposta expira e usuário recarrega/reenvia
- **THEN** lookup/reenvio da chave e conteúdo originais recupera um único pedido, sem nova compra.

### Requirement: CO05 Estados e recuperação

Pedido MUST representar pending, confirmed e declined, recuperar por refresh/reconexão e manter terminais imutáveis. Recibo MUST aparecer somente após confirmação efetiva no mock.

#### Scenario: Desconexão pendente
- **WHEN** conexão cai enquanto pedido está pendente e simulação resolve fora da conexão
- **THEN** REST após reconnect/refresh recupera estado terminal do mesmo pedido sem depender de replay do evento.

### Requirement: CO06 Estoque e carrinho com efeitos únicos

Criação MUST reservar estoque atomicamente. Confirmação MUST aplicar efeitos uma vez e remover somente quantidades compradas das linhas capturadas; recusa/falhas MUST preservar cart e liberar reserva quando aplicável.

#### Scenario: Carrinho editado durante pendência
- **WHEN** usuário acrescenta quantidade ou remove/recria linha antes da confirmação
- **THEN** confirmação consome só quantidade comprada no lineId original, preservando acréscimos e nova linha.

### Requirement: CO07 Snapshot e transação simulada

Recibo MUST reproduzir snapshot imutável de itens/arte/tokens/preços/quantidades/taxas/desconto/total/dados/carteira/rede e transação simulada. Mudanças posteriores MUST NOT alterar recibo; explorador MUST identificar simulação.

#### Scenario: Catálogo modificado após compra
- **WHEN** NFT, preço ou carteira é atualizado após confirmed
- **THEN** recibo continua com dados do momento da compra e não anuncia transação blockchain real.
