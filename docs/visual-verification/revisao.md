# Revisão visual das referências

Revisão em 06/11/2026 a partir das capturas em `F01`–`F15`, geradas por `npm run capture:visual`. Cada pasta contém referência do Figma, aplicação e diff sem máscara; as capturas mobile completas também foram preservadas. A avaliação considera identidade, composição, conteúdo e comportamento, conforme a decisão do usuário de retirar o critério pixel perfect. Os valores do diff não são, por si só, critérios de aceite.

| Frame | Referência e estado da aplicação | Diferenças relevantes identificadas |
| --- | --- | --- |
| F01 | Início desktop: hero, filtros, catálogo, destaque, promoções, editorial e rodapé. | Contagens vêm do catálogo simulado; o nono card é um item funcional, enquanto o desenho tem uma imagem sem identificação (L07). Badge mostra a quantidade real. |
| F02 | Detalhe desktop: galeria, dados, edições, ações, informações, relacionados e rodapé. | A aplicação oferece ação de adicionar separada e dados coerentes do item; texto e estado de sessão vêm da API. |
| F03 | Carrinho desktop com três linhas, resumo, recomendações e rodapé. | Tokens de Violet e Ivory usam identidades canônicas (C02); badge soma as unidades (C08). |
| F04 | Checkout desktop autenticado com três itens e carteira conectada. | Campos aparecem preenchidos; revisão e desconexão são ações adicionais necessárias ao fluxo (L03/L17); botão de perfil e badge refletem sessão e carrinho. |
| F05 | Recibo desktop do pedido confirmado, com itens, totais e explorador simulado. | Mostra dados adicionais do snapshot, subtotal/desconto e indicação de simulação; transação e carteira são reais apenas dentro da simulação. |
| F06 | Login desktop sobre catálogo. | O catálogo de fundo usa identidades e contagens consistentes da API (C04); o contorno de foco pode aparecer na captura. |
| F07 | Cadastro desktop sobre catálogo. | Mesmo tratamento do fundo de F06; o toggle de confirmação permite acessar a senha sem criar autenticação externa. |
| F08 | Perfil desktop autenticado. | Nome e e-mail são preenchidos pela sessão; cabeçalho mostra ação de perfil (C07). |
| F09 | Carteiras desktop autenticado. | Cabeçalho mostra ação de perfil; controles e dados refletem as carteiras armazenadas. |
| F10 | Início mobile com hero, busca, catálogo e navegação. | A arte do quarto card acompanha a identidade canônica (C04); ações de favoritos e badge são funcionais. As cores originais do hero foram mantidas por decisão do usuário; contraste medido abaixo de 4,5:1. |
| F11 | Detalhe mobile com sobreposição, opções de edição e barra de compra. | Primeiro chip usa 1/1 em vez do 1/10 duplicado do desenho (C03); a imagem e os dados são da fixture canônica. |
| F12 | Carrinho mobile com quatro itens e resumo. | Subtotal 8.14 e total 8.156 ETH corrigem a soma ilustrativa (C01); todas as linhas têm remoção acessível (C10). |
| F13 | Checkout mobile em etapa de carteira e rede. | Total segue cotação consistente (C01); revisão e desconexão são acessíveis (L03/L17), e os nomes das carteiras vêm da fixture. |
| F14 | Login mobile em página inteira. | Campos e foco representam o estado do teste; ações externas informam indisponibilidade em vez de autenticar falsamente. |
| F15 | Cadastro mobile em página inteira. | O teste captura formulário vazio; validação e retorno são cobertos separadamente. |

As oito baselines de página completa em `tests/e2e/visual-regression.spec.ts-snapshots` representam a aplicação em Chromium/macOS nos viewports de 390 e 1440 px. Elas foram reproduzidas sem atualização no teste de regressão; não são referências do Figma nem aprovação do G05. A auditoria de contraste e acessibilidade, inclusive o conflito conhecido do hero, permanece aberta. Capturas desktop de autenticação incluem foco programático; diferenças decorrentes de estado, dados ou foco não são tratadas como defeito visual por contagem de pixels.

Na conferência posterior dos arquivos de comparação, as 15 referências e capturas tiveram hashes compatíveis com `comparisons.json`, e as 15 imagens de diferença estavam presentes. As observações no manifesto foram registradas na geração das capturas e podem mencionar decisões então pendentes; esta revisão registra as decisões posteriores. Os estados do manifesto permanecem pendentes, sem aprovação automática do G05.
