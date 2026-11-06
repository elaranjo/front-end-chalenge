# Verificação de entrega em andamento

Este documento registra evidências de preparação; não aprova a entrega nem os gates pendentes.

## Estado observado em 06/11/2026

- O repositório configurado é `https://github.com/junglegaming/frontend-challenge`; a branch remota `main` apontava para `fea4e7c7d35be125150576d3d03af2460023c17f`.
- A consulta autenticada ao GitHub com a conta `elaranjo` retornou permissão de leitura, mas não de push, no repositório de origem. A pedido do usuário, foi criado o destino público [elaranjo/front-end-chalenge](https://github.com/elaranjo/front-end-chalenge), e a API confirmou permissão de administração e push. O remoto local `delivery` aponta para esse destino; `origin` permanece intacto. O commit de implementação `6c664d8eb4c5d813bd22e6b2b1ac73c4ba92bb50` foi enviado ao `main` e confirmado pela API; alterações posteriores de documentação podem gerar outro commit.
- O projeto Vercel `frontend-challenge` já existe na conta conectada. Seu último deployment de produção estava `READY` e registrava esse mesmo commit na metadata.
- A URL `https://frontend-challenge-one-tau.vercel.app/` respondeu HTTP 200. O HTML público observado tinha idioma `en` e referenciava `index-DJweSYHv.js`; o build local disponível naquela observação tinha idioma `pt-BR` e referenciava `index-CqxhXdkq.js`. Esses arquivos demonstravam que o build publicado observado diferia daquele build local. HTTP 200 e status `READY` não provam os fluxos ou a correspondência da entrega; a comparação precisará ser refeita com o commit final.
- Um checkout isolado do commit `6c664d8` passou em `npm ci`, cópia de `.env.example` para `.env`, typecheck, lint, build e 106 testes focados. No preview isolado, a página inicial carregou, o service worker controlou a página, a API respondeu, um cliente Socket.IO recebeu `nft.updated` e a rota de detalhe funcionou em acesso direto e refresh. Isso não é uma execução integral E2E desse checkout nem comprova a URL pública.

## Antes de considerar a entrega pronta

As tarefas 11.1–11.3 e 11.5 permanecem abertas, inclusive as limitações de acessibilidade documentadas em [reports/accessibility/revisao-manual.md](../reports/accessibility/revisao-manual.md). Para G07, registrar o commit final e os links efetivamente entregues; verificar instalação a partir desse commit, correspondência do build público, acesso direto e refresh de rotas, assets e service worker, compra confirmada e recusada, timeout, reconexão e reset. Registrar os resultados observados, sem assumir que o deployment existente contém as alterações locais.

Na conferência anterior ao commit de implementação, somente `README.md` estava versionado. O commit incluiu código, lockfile, assets, testes, OpenSpec e relatórios; `.env.example` documenta a configuração pública dos mocks e `.env` permanece ignorado. As pastas de configuração `.agent/` e `.agents/` foram preservadas localmente fora do commit. Os relatórios e traces preservados representavam aproximadamente 268 MiB naquela conferência. O commit foi preparado como versão em andamento; G04, G05 e a publicação ainda precisam ser concluídos.

Em uma nova conferência local em 06/11/2026, os comandos `check:figma-assets`, `check:figma-geometry` e `check:figma-typography` terminaram sem erros. O primeiro verificou hashes e inventários, incluindo 15 referências, 197 SVGs públicos, quatro imagens NFT, seus derivados e fontes; a busca de caminhos literais em `src` não cobre referências dinâmicas. Os demais verificaram a geometria de cinco assets específicos e inventariaram a tipografia extraída. Essas checagens não comprovam fidelidade visual nem a presença dos arquivos em um commit ou repositório de entrega.
