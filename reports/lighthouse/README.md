# Auditoria Lighthouse local

## Coleta mais recente

Em 06/11/2026 às 20:15 UTC, o build local foi medido novamente, com três execuções por página/perfil. Os 12 arquivos HTML, 12 JSON e `summary.json` correspondem a esta coleta; não houve erros de execução nem avisos do Lighthouse. O SHA-256 do `index.html` servido no preview e do build local é `b02c79fbcc496f433f2730dcfa0ce65bf039cd55ef03f6e76ace5d105587090e`. As coletas das [17:08 UTC](../lighthouse-20261106-1708/README.md), [16:57 UTC](../lighthouse-20261106-1657/README.md), [16:37 UTC](../lighthouse-20261106-1637/README.md), [16:27 UTC](../lighthouse-20261106-1627/README.md) e [14:23 UTC](../lighthouse-20261106-anterior/README.md) foram preservadas; a tabela histórica abaixo descreve uma coleta ainda anterior. Ambiente: macOS arm64, Apple M2 Pro, Node 24.22.1, Chrome for Testing 156.0.8078.4 e Lighthouse 13.6.0, com perfis temporários e mocks ativos.

| Página | Perfil | Performance | Acessibilidade | Boas práticas | SEO | LCP mediano | CLS mediano | TBT mediano |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Início | Mobile | 88 | 100 | 100 | 100 | 3.909 ms | 0 | 13,5 ms |
| Início | Desktop | 99 | 100 | 100 | 100 | 1.012 ms | 0,00017 | 0 ms |
| Detalhe | Mobile | 87 | 100 | 100 | 100 | 4.101 ms | 0 | 12 ms |
| Detalhe | Desktop | 99 | 100 | 100 | 100 | 941 ms | 0 | 0 ms |

Performance mobile permanece abaixo da meta de 90: a mediana de LCP foi 3,91 s no início e 4,10 s no detalhe. Nas segundas medições mobile, o Lighthouse estimou aproximadamente 131 KiB e 135 KiB de JavaScript não utilizado, respectivamente; a imagem do detalhe é descoberta após a inicialização da aplicação. Essas evidências indicam oportunidades de melhoria, sem isolar uma única causa. As limitações de medição de rede com service worker descritas abaixo continuam aplicáveis; a pontuação automática de acessibilidade não invalida a medição específica de contraste do hero mobile. Esta coleta local não valida a publicação.

## Coleta anterior

Coleta de 6 de novembro de 2026, às 09:22 UTC, no build de produção servido por `vite preview`, com `VITE_ENABLE_MOCKS=true` e cenário padrão. São três medições independentes por página e perfil. Cada execução inicia um perfil temporário do Chrome, sem armazenamento ou service worker prévio; os mocks e seus assets são inicializados normalmente. Os 12 arquivos HTML e 12 JSON contêm os resultados individuais; `summary.json` reúne valores, configurações e avisos de cada execução.

Ambiente: macOS Darwin 25.6.0 arm64, Apple M2 Pro, 10 CPUs lógicas; Node 24.22.1; Chrome for Testing 156.0.8078.4; Lighthouse 13.6.0. O Lighthouse usa throttling simulado: no mobile, RTT 150 ms, throughput 1.638,4 Kbps e CPU 4×; no desktop, RTT 40 ms, throughput 10.240 Kbps e CPU 1×. Os parâmetros completos de rede, emulação e demais opções constam em `configSettings` nos JSON individuais e no resumo.

| Página | Perfil | Performance | Acessibilidade | Boas práticas | SEO | LCP mediano | CLS mediano | TBT mediano |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Início | Mobile | 88 | 100 | 100 | 100 | 3.860 ms | 0 | 10,5 ms |
| Início | Desktop | 99 | 100 | 100 | 100 | 942 ms | 0,00017 | 0 ms |
| Detalhe | Mobile | 86 | 100 | 100 | 100 | 4.153 ms | 0 | 17 ms |
| Detalhe | Desktop | 98 | 100 | 100 | 100 | 1.018 ms | 0,04741 | 0 ms |

As metas são, respectivamente, 90/95/95/90. Performance mobile ficou abaixo de 90 em ambas as páginas. O LCP simulado ficou em 3,86 segundos na home e 4,15 segundos no detalhe, enquanto o TBT mediano foi baixo. Nos relatórios, o elemento de LCP é a seção inicial da home e a imagem principal no detalhe; a imagem do detalhe é descoberta depois de executar a aplicação. A avaliação também estima JavaScript não utilizado no carregamento inicial. Esses dados indicam oportunidades de investigar a cadeia de inicialização, descoberta de recursos e código inicial; não isolam uma única causa nem comprovam o comportamento de produção em rede real.

Na segunda execução mobile de cada página, o Lighthouse estimou aproximadamente 130–135 KiB de JavaScript não utilizado e 150–160 ms de economia potencial em CSS que bloqueia a renderização. A imagem principal do detalhe já usa prioridade alta, mas é descoberta após o documento inicial. Um preload condicionado à home mobile antecipou o fundo do hero: a mediana do LCP passou de 4.061 ms para 3.879 ms nesta máquina, em duas coletas de três medições; a performance permanece abaixo da meta. O build também informa um bundle dos mocks acima de 500 kB. São estimativas do laboratório, não tempos medidos em produção. A inicialização dos mocks precisa preceder a importação do cliente Socket.IO: antecipá-la quebrou os testes de rotas e sincronização. A investigação de otimizações permanece aberta; não há evidência de que uma única alteração resolveria o resultado mobile.

**Limitação da coleta:** no preview com MSW ativo, uma inspeção independente do Chrome DevTools Protocol no detalhe registrou a imagem principal como resposta do service worker (`fromServiceWorker: true`) e `encodedDataLength: 0`, embora o PNG original tenha 1.885.435 bytes. Na coleta atual, o Lighthouse identificou o WebP equivalente de 1.246.548 bytes, mas ainda registrou transferência zero para essa imagem e outras artes NFT. Portanto, suas estimativas de bytes e de rede podem não representar o custo real desses downloads; as pontuações são resultados da configuração local, não uma validação completa do desempenho de rede. A coleta complementar de Resource Timing descrita abaixo registra o tamanho dos corpos, sem resolver a limitação de transferência.

Para reproduzir, use Node 24 e o Chromium instalado pelo Playwright:

```sh
npm ci
npx playwright install chromium
npm run build
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

Em outro terminal, execute `npm run audit:lighthouse`. O comando sobrescreve os relatórios desta pasta; ele aceita `LIGHTHOUSE_BASE_URL` e `CHROME_PATH` quando necessário. Os resultados locais não constituem prova da URL pública nem de fidelidade visual.

Os quatro PNGs originais foram preservados e a aplicação usa derivados WebP sem perda, com pixels equivalentes verificados no Chromium. Os 12 relatórios desta coleta incluem esses derivados; a limitação de transferência zero via service worker ainda requer investigação.

Uma coleta complementar em 06/11/2026 às 10:09 UTC, registrada em [resource-timing.json](resource-timing.json), leu `encodedBodySize` pelo Resource Timing com o Service Worker ativo e um contexto limpo por página/perfil. O navegador registrou quatro imagens NFT distintas na home, somando 5.282.914 bytes codificados, e uma no detalhe, de 1.246.548 bytes, tanto em mobile como desktop. Em todos esses registros `transferSize` foi zero. Isso confirma o tamanho dos corpos observados, mas não mede bytes efetivamente transferidos nem corrige a simulação de rede do Lighthouse. A coleta não aplica limitação de rede e suas durações locais não representam produção.

Com o preview ativo, execute `npm run audit:resource-timing` para regenerar a evidência complementar. O script falha se a página não estiver sob controle do Service Worker ou se não conseguir obter o tamanho codificado das imagens.

Após a coleta das 09:22 UTC, o diálogo de revisão do checkout teve correções de foco e rolagem. As medições mais recentes no início desta página foram executadas posteriormente. A versão publicada ainda deve ser confrontada com o build entregue.
