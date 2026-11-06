## Purpose

Permitir edição persistente do perfil, avatar, senha e duas carteiras simuladas com validação e uso no pagamento.

## ADDED Requirements

### Requirement: CA01 Perfil e senha atômicos

Salvar MUST validar e persistir perfil/avatar e mudança opcional de senha em uma operação atômica. Campos de senha vazios MUST manter a senha; alteração MUST exigir atual correta e confirmação da nova.

#### Scenario: Senha atual incorreta
- **WHEN** usuário altera nome/avatar e informa senha atual errada ao Salvar
- **THEN** nenhuma alteração é persistida, erros são associados e draft permite correção.

### Requirement: CA02 Avatar validado e persistente

Alterar/Remover avatar MUST permitir preview e edição staged, validar PNG/JPEG/WebP até 2 MiB e persistir somente ao Salvar. Refresh MUST recuperar o avatar confirmado.

#### Scenario: Arquivo inválido
- **WHEN** usuário seleciona arquivo inválido ou maior que o limite
- **THEN** erro acessível é exibido e avatar salvo permanece intacto.

### Requirement: CA03 Carteiras principal e secundária

Usuário MUST poder cadastrar/editar os slots principal/secundário, validar campos desenhados e erros da API, recuperar após refresh e utilizá-los no checkout. Igual à principal MUST copiar o draft uma vez conforme L15.

#### Scenario: Cópia e edição posterior
- **WHEN** usuário copia principal para secundária, edita e salva ambas
- **THEN** valores persistem por slot e alteração futura da principal não modifica secundária automaticamente.

### Requirement: CA04 Validação simulada sem integração real

Rede/tipo/ENS/endereço/indicação MUST respeitar contracts.md e a obrigatoriedade visual, com dados fictícios e sem exigir propriedade ENS, serviço externo ou carteira real.

#### Scenario: Dados fictícios válidos
- **WHEN** todos os campos obrigatórios recebem valores aceitos pelo contrato
- **THEN** salvamento e posterior uso no pagamento funcionam sem extensão ou backend privado.
