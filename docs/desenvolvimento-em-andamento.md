# Execução da base em desenvolvimento

O marketplace está em implementação: as telas e fluxos principais já existem e o commit `d1810af` foi publicado, mas os gates de verificação e a auditoria da entrega permanecem abertos. O Figma é referência para identidade, composição e comportamento; equivalência pixel perfect não é requisito desta entrega, por decisão do usuário. Os comandos abaixo executam a aplicação e os testes disponíveis. O enunciado original está preservado em [challenge-brief.md](challenge-brief.md).

## Ambiente

Use Node 24.22.1 e npm 11.19.1, conforme `.nvmrc`, `engines` e `packageManager`. Copie `.env.example` para `.env` para configurar `VITE_ENABLE_MOCKS=true`; os mocks MSW precisam estar habilitados para os testes e a simulação local. O build da Vercel os habilita explicitamente em `vercel.json`.

```sh
npm ci
cp .env.example .env
npm run dev:mock
```

O Vite informa o endereço local ao iniciar. Para verificar a base:

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run preview
```

Em 06/11/2026, uma cópia isolada do estado de trabalho, sem `node_modules` ou build anteriores, passou por `npm ci`, typecheck, lint, build e 106 testes de unidade. Cinco testes nessa mesma cópia verificaram o preview otimizado, incluindo Socket.IO, reconexão, isolamento de assinatura e rotas diretas; para evitar conflito com o servidor local existente, usaram a porta 4174 no lugar da 4173 e uma configuração de teste isolada. O lint registrou sete avisos de Fast Refresh em `router.tsx`, e o build avisou sobre um chunk superior a 500 kB. A cópia inclui arquivos ainda não versionados e antecede alguns ajustes posteriores de documentação e testes; ela não substitui a verificação de um checkout do commit de entrega.

Posteriormente, um checkout isolado do commit `6c664d8` passou em `npm ci`, cópia de `.env.example` para `.env`, typecheck, lint, build e 106 testes focados. Um smoke do preview em 4175 observou o service worker, resposta REST, evento `nft.updated` via cliente Socket.IO e acesso direto/refresh do detalhe. Essa verificação não executou todos os E2E nem testou uma URL pública.

Uma clonagem nova do repositório de entrega no commit publicado `d1810af` também passou em `npm ci`, typecheck, lint, build e 106 testes focados; no preview, detalhe direto e refresh, service worker e API simulada foram verificados. As limitações e a verificação da URL pública estão em [delivery-verification.md](delivery-verification.md).

As [12 medições Lighthouse da URL publicada](../reports/lighthouse-vercel-20261106/README.md) atingiram as metas em todas as medianas. Para repetir a coleta em um preview de produção e consultar o histórico local, siga o procedimento em [reports/lighthouse/README.md](../reports/lighthouse/README.md). O script aceita `LIGHTHOUSE_BASE_URL` para apontar à URL pública, mas sobrescreve os arquivos em `reports/lighthouse/`; preserve os relatórios existentes antes de executá-lo.

Com o preview ativo na porta 4173, `npm run audit:accessibility` executa as regras automatizadas WCAG 2 A/AA e 2.1 A/AA do axe nas telas principais, incluindo erros de autenticação, carrinho vazio, revisão e recibo, em 390, 414, 768 e 1440 pixels, e grava `reports/accessibility/axe.json`. O comando retorna código de erro quando encontra violações; resultados inconclusivos exigem revisão manual. Essa coleta não substitui os testes manuais e a revisão dos estados adicionais.

Os testes de navegador usam Chromium e o Playwright. Instale o navegador com `npx playwright install chromium` quando necessário e execute `npm run test:e2e`; o comando gera primeiro o build usado pelos testes de preview. A configuração inicia servidores de desenvolvimento e preview e preserva traces das falhas; o relatório HTML fica em `playwright-report/`. Consulte [a cobertura e os resultados mais recentes](../reports/e2e-coverage.md). Os testes não substituem a revisão completa de acessibilidade nem a validação da aplicação publicada.

Na seção 11, `npm test` passou com 106 testes. A última suíte integral e as verificações direcionadas posteriores estão em [reports/e2e-coverage.md](../reports/e2e-coverage.md). O contraste medido do texto no hero mobile ficou abaixo de 4,5:1 em 320, 390 e 414 px; as cores originais permanecem por decisão explícita do usuário. A auditoria axe mais recente registrou zero violações automáticas e 43 resultados inconclusivos nos 56 casos em 390/414/768/1440; isso não invalida a medição específica sobre o gradiente. G04 e G05 continuam pendentes.

Uma execução posterior, após os ajustes de interface e os novos cenários de favoritos e estoque, concluiu 116 testes E2E e 106 testes de unidade. Durante os E2E, o servidor de desenvolvimento registrou uma rejeição não tratada de `POST /auth/logout` com HTTP 404 simulado, originada em `ProfilePage.logout`; o teste não falhou por isso. O tratamento posterior conserva a limpeza local e informa quando a revogação remota não é confirmada, sem redirecionar uma nova sessão por resposta atrasada. Um teste E2E direcionado usa o cenário `validation-errors` e observa HTTP 422 no logout pela rede MSW, além de verificar aviso, limpeza e ausência de exceção; ele não reproduz o 404 original. A revogação remota em caso de falha continua sem confirmação.

`npm run check:figma-assets` verifica a integridade do snapshot, dos 15 PNGs de referência, dos SVGs inventariados, das imagens NFT e da fonte local. Confere os IDs dos frames e suas dimensões arredondadas contra o inventário de propriedades, além de procurar cópias de bytes idênticos das referências nos arquivos públicos. Também confronta os 67 vínculos de imagem no inventário com os nós, dimensões, modos de escala e transformações do JSON extraído do snapshot. Os inventários registram hashes e informações de licença disponíveis. A checagem de hashes não detecta cópias alteradas de capturas nem prova que todos os assets necessários foram extraídos ou que a fidelidade visual foi aprovada.

`npm run capture:visual` reproduz os estados atualmente preparados e atualiza as comparações em `docs/visual-verification/`. `npm run test:visual` compila e compara oito capturas de página completa para regressão da aplicação: início, detalhe, carrinho e pagamento em viewports de 390 × 844 e 1440 × 900, com fixtures controladas e movimento reduzido. As baselines de Chromium no macOS estão em `tests/e2e/visual-regression.spec.ts-snapshots/`; são referências de regressão da aplicação, não uma aprovação pixel perfect do Figma. Outros sistemas operacionais precisam de baselines próprias e revisão antes de atualizar imagens. A [revisão dos 15 frames](visual-verification/revisao.md) registra as diferenças observadas; ela não aprova o G05, que ainda depende das verificações de acessibilidade.

## Contas e cenários simulados

As contas são fictícias: `colecionador.a@kurio.test` / `DemoA!2026` e `colecionador.b@kurio.test` / `DemoB!2026`. O cupom válido é `KURIO10`.

Com os mocks habilitados, a URL pode selecionar um cenário, por exemplo `/?mockScenario=empty`, `/?mockScenario=slow` ou `/?mockScenario=payment-declined`. A seleção redefine o estado quando o cenário muda; recarregar com o mesmo cenário preserva a sessão. A lista completa está em `supportedScenarios` em [reset-seed.ts](../src/mocks/reset-seed.ts). A seleção é feita pelo parâmetro de URL ou pelo endpoint de reset; não há painel de seleção na interface.

Para redefinir o cenário manualmente, abra o console do navegador em uma página local já controlada pelo service worker e execute:

```js
await fetch('/api/v1/__mock/reset', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ scenario: 'default', clockMode: 'real' }),
}).then((response) => response.json())
```

O reset recria os dados simulados e limpa sessão, cache e rascunhos associados à geração anterior. Nos cenários visuais, ele cria o carrinho da nova geração na mesma transação para que uma requisição anterior não reivindique a fixture. `GET /api/v1/__mock/state` informa o cenário atual. Os controles são locais à simulação; detalhes dos contratos, ações e cenários estão em [contracts.md](../openspec/changes/implement-nft-marketplace-challenge/contracts.md).

## Reprodução de falhas

- Acesse `/?mockScenario=http-503` para simular falhas transitórias REST; o carrinho deve oferecer nova tentativa. Redefina para `default` pelo comando de reset acima para recuperar o serviço.
- Acesse `/?mockScenario=payment-declined`, autentique-se, prepare uma carteira e confirme um carrinho para observar a recusa simulada. O carrinho permanece disponível para uma nova tentativa.
- Acesse `/?mockScenario=timeout-after-order-create` e confirme uma compra para simular perda da resposta após o registro. Recarregar e autenticar-se com a mesma conta permite recuperar a tentativa existente.
- Para reproduzir automaticamente expiração de sessão durante a recuperação de uma compra, execute `npx playwright test tests/e2e/checkout-recovery-ui.spec.ts -g 'lost order response'`. O teste controla o mock, observa a transição pela interface e verifica a recuperação do mesmo pedido nos dois tamanhos.
- Para reproduzir eventos duplicados e antigos, execute `npx playwright test tests/e2e/realtime-replay-responsive.spec.ts`. O teste usa o cliente Socket.IO, dispara os controles da simulação e verifica que o preço no carrinho não regride em 390 e 1440 px.

Os cenários alteram apenas o estado fictício do navegador. As instruções finais de entrega, publicação e auditoria ainda dependem dos gates do OpenSpec.
