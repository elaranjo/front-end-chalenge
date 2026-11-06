## Why

O repositório contém o enunciado do desafio e a inspeção dos 15 frames, mas ainda não possui aplicação. A entrega precisa implementar integralmente descoberta, compra e conta com a stack obrigatória e evidências de fidelidade visual, sem transformar inconsistências dos exemplos em regras de negócio nem ampliar o escopo.

Atualização de escopo: o usuário considerou a aparência atual suficientemente próxima e retirou a exigência de equivalência pixel perfect. O Figma continua como referência de identidade, composição e comportamentos descritos; a entrega deve priorizar todas as exigências do desafio. Um refinamento pixel perfect poderá ser solicitado posteriormente.

## What Changes

- Implementar as nove telas e todos os frames desktop/mobile existentes, usando os assets, estilos e instruções verificadas no Figma. Adaptar tablet e as telas mobile sem referência com os mesmos componentes.
- Entregar catálogo com URL persistente, detalhe, favoritos, carrinho preciso em ETH, cupom, checkout autenticado e pedidos idempotentes com estados pendente, confirmado e recusado.
- Implementar sessão, cadastro, login, logout, perfil, avatar, senha e carteiras persistentes, com isolamento entre usuários e retomada após expiração.
- Usar efetivamente React, TypeScript, TanStack Router/Query, Axios, REST, Tailwind, shadcn/ui, MSW, Socket.IO, Playwright e Lighthouse.
- Simular REST e Socket.IO na rede com estado compartilhado e persistido, cenários determinísticos, reset e falhas reproduzíveis no desenvolvimento, testes e build público.
- Fechar os 12 conflitos, 27 lacunas e 11 diferenças visuais da inspeção em decisões rastreáveis. Preservar diferenças intencionais e registrar os desvios indispensáveis à consistência dos dados e à acessibilidade.
- Entregar comparação com Figma, regressão visual versionada, E2E, relatórios/traces, auditorias Lighthouse, documentação e deploy público correspondente ao código.

## Capabilities

### New Capabilities

- `interface-fidelity`: identidade visual, quinze frames, assets locais, adaptações responsivas, estados e acessibilidade.
- `catalog-discovery`: descoberta, URL, filtros, ordenação, paginação, detalhe, galeria e favoritos.
- `collector-session`: cadastro, autenticação, expiração, logout, retomada e isolamento de sessões.
- `collector-account`: perfil, avatar, mudança de senha e carteiras principal/secundária persistidas.
- `nft-cart`: carrinho por visitante/usuário, merge, quantidades, cupom, cotação e precisão decimal.
- `checkout-orders`: revisão, conexão simulada, reconfirmação, criação idempotente e recuperação de pedidos/recibos.
- `mock-network-scenarios`: contratos REST tipados, MSW, armazenamento consistente, configuração e cenários determinísticos.
- `realtime-reconciliation`: Socket.IO real no cliente, eventos versionados, autenticação, descarte de eventos antigos e reconciliação REST.
- `delivery-verification`: E2E, referências visuais, acessibilidade, Lighthouse, documentação, execução limpa e publicação.

### Modified Capabilities

Nenhuma. Não há especificações principais existentes.

## Impact

Aplicação nova em `src/`, assets locais em `public/`, fixtures/mocks, testes, configurações de build/auditoria/publicação e documentação. O README original será preservado como enunciado antes de receber instruções da solução. A change inclui contratos, decisões, matriz de referências visuais, plano de verificação e rastreabilidade; essas referências são parte do contrato da implementação.

O escopo não inclui blockchain, extensões de carteira, gateway, OAuth real, AR/VR/scanner, tema claro nem páginas editoriais, suporte, atividade, ofertas ou downloads. Elementos dessas categorias já desenhados permanecem visuais e têm ação auxiliar honesta, sem falso sucesso. Esta etapa produz planejamento; não executa implementação nem deploy.
