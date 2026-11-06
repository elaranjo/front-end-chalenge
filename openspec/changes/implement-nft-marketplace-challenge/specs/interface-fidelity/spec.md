## Purpose

Reproduzir as referências verificadas do Figma e assegurar acesso integral aos mesmos fluxos em todos os tamanhos exigidos.

## ADDED Requirements

### Requirement: IF01 Fidelidade às quinze referências

A interface MUST seguir a identidade visual, a composição, as artes e os comportamentos definidos nas referências F01–F15, mantendo os elementos e fluxos exigidos pelo desafio. A comparação visual MUST identificar omissões e divergências relevantes; equivalência pixel perfect, igualdade de rasterização e correspondência exata de cada medida não são critérios de aceite. As diferenças V01–V11 continuam como orientação para preservar variantes e composição relevantes.

#### Scenario: Comparação com fonte
- **WHEN** cada tela é renderizada no viewport e cenário da referência
- **THEN** a revisão frente à fonte original confirma a presença dos blocos e controles esperados e uma apresentação visual coerente, registrando divergências relevantes e sem exigir igualdade pixel a pixel.

### Requirement: IF02 Assets e fontes locais

Imagens, fontes e vetores disponíveis no arquivo MUST estar acessíveis localmente e manter seus recortes/identidades. A interface MUST NOT substituir um asset existente por um similar ou uma captura estática de tela.

#### Scenario: Execução local
- **WHEN** o app executa sem serviços privados de assets
- **THEN** logos, ícones, fontes e imagens corretos são carregados e seus vínculos à fonte estão documentados.

### Requirement: IF03 Responsividade completa

Todas as nove telas MUST funcionar em 390, 768 e 1440 pixels e corresponder aos frames disponíveis em 414. Perfil, carteiras, recibo e demais estados sem frame MUST seguir as adaptações L01–L03, sem eliminar campos ou ações.

#### Scenario: Viewport e conteúdo expandido
- **WHEN** usuário redimensiona ou usa zoom/teclado virtual
- **THEN** conteúdo permanece alcançável, sem overflow horizontal indevido ou CTAs/erros inacessíveis, e os dados não mudam por breakpoint.

### Requirement: IF04 Carregamento e feedback

Catálogo, detalhe e resumo MUST apresentar skeleton com shimmer e dimensões estáveis enquanto aguardam dados. Todos os recursos MUST representar vazio, erro recuperável e atualização em segundo plano sem apagar conteúdo válido.

#### Scenario: Movimento reduzido
- **WHEN** dados demoram e prefers-reduced-motion está ativo
- **THEN** skeleton reserva o espaço do conteúdo sem animação e retry oferece recuperação em falha.

### Requirement: IF05 Acesso por teclado e tecnologia assistiva

Controles MUST ter semântica, nomes, labels, erros associados e foco visível. Diálogos/drawers MUST controlar e restaurar foco, aceitar Escape e anunciar feedback relevante. Estados MUST ter indicação além da cor.

#### Scenario: Dialog e mutation
- **WHEN** usuário abre e fecha um dialog por teclado e uma mutation falha
- **THEN** foco não escapa do dialog aberto, retorna ao acionador no fechamento e o erro é anunciado e associado ao contexto.

### Requirement: IF06 Ações auxiliares honestas

Elementos desenhados fora do escopo MUST permanecer coerentes com L08/L11/L27 e MUST NOT aparentar autenticação, envio de mensagem, blockchain ou pagamento real. Seções editoriais/promoções/footer da home desktop MUST permanecer na composição.

#### Scenario: Ação sem serviço
- **WHEN** usuário aciona social, recuperação de senha, newsletter, ícone central ou link de página excluída
- **THEN** recebe indicação acessível de indisponibilidade, sem sucesso fictício ou nova funcionalidade fora do enunciado.
