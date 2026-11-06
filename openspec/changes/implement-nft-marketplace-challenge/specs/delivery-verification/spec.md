## Purpose

Demonstrar aderência ao desafio por evidências reproduzíveis de fluxo, fidelidade visual, auditoria e publicação.

## ADDED Requirements

### Requirement: DV01 Stack efetiva e execução limpa

Entrega MUST usar efetivamente toda a stack obrigatória do README e incluir código, lockfile, assets, mocks, fixtures, testes, auditoria e comandos documentados. Checkout limpo MUST executar sem backend/serviço privado.

#### Scenario: Instalação reproduzível
- **WHEN** avaliador segue README em checkout limpo
- **THEN** instala, roda mocks, verifica tipos/lint, build/preview, E2E e Lighthouse com comandos fornecidos.

### Requirement: DV02 E2E e regressão visual

Testes MUST cobrir E01–E12 em verification.md, fluxos principais Chromium desktop/mobile, UI e rede real dos mocks, isolamento e relógio/latência/eventos controlados. Home/detalhe/cart/pagamento MUST ter baselines versionadas e dados estáveis.

#### Scenario: Falha reproduzida
- **WHEN** teste E2E falha em cenário determinístico
- **THEN** relatório HTML e trace da falha permitem reproduzir, sem teste que simule evento direto na UI.

### Requirement: DV03 Prova independente de fidelidade

Entrega MUST demonstrar revisão de F01–F15 com a fonte Figma, identificar omissões e divergências visuais relevantes e documentar os assets. A revisão e as baselines não exigem equivalência pixel perfect. Todos os fluxos MUST ser avaliados em 390/768/1440 e referência 414.

#### Scenario: Baseline criada
- **WHEN** regressão visual do app é preparada
- **THEN** a revisão da fonte e as divergências relevantes estão registradas; baselines representam a implementação revisada e não são usadas para esconder defeitos.

### Requirement: DV04 Auditoria completa

Lighthouse MUST auditar início/detalhe mobile/desktop três vezes cada, em build otimizado com mocks padrão e funcionalidades/assets reais. MUST reportar medianas, LCP/CLS/TBT, config/versões/ambiente e 12 relatórios HTML/JSON. Metas 90/95/95/90 MUST orientar correções e desvios abaixo MUST ser justificados.

#### Scenario: Coleta de resultados
- **WHEN** as doze medições terminam
- **THEN** relatório mostra medianas por página/perfil e causas dos resultados abaixo das metas sem simplificação exclusiva para auditoria.

### Requirement: DV05 Documentação e limites

README MUST documentar setup/env/credenciais fictícias/cenários/reset/comandos/falhas. ARCHITECTURE MUST documentar REST/eventos/sessão/cart/cache/retries/reconciliação, UX, limitações e desvios do Figma.

#### Scenario: Avaliação de falha
- **WHEN** avaliador segue reprodução documentada de expiração/timeout/evento antigo
- **THEN** obtém cenário previsto e entende políticas de recuperação e limitações do transporte/mock.

### Requirement: DV06 Publicação obrigatória

Entrega MUST fornecer URL pública do app e link do repositório acessível à avaliação, correspondentes ao código entregue, mantendo mocks e tempo real operantes. Acesso direto/refresh de rotas MUST funcionar na hospedagem.

#### Scenario: Validação pública
- **WHEN** avaliador abre rota privada/detalhe por URL e executa compra/evento na aplicação publicada
- **THEN** navegação, autenticação, simulação e recuperação funcionam e commit/build são identificáveis.
