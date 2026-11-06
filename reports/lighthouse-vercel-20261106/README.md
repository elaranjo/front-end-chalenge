# Lighthouse — aplicação publicada na Vercel

Em 06/11/2026, foram realizadas três medições para cada combinação de página e perfil, diretamente em `https://frontend-challenge-one-tau.vercel.app`: página inicial (`/`) e detalhe (`/nfts/emerald-ape-042`), em mobile e desktop. Cada execução usou um perfil temporário do Chrome, sem dados, cache ou service worker anteriores. A aplicação, as imagens e os mocks carregaram normalmente; as capturas finais dos relatórios mostram o conteúdo das respectivas páginas.

Ambiente: macOS arm64, Apple M2 Pro, Node 24.22.1, Chrome for Testing 156.0.8078.4 e Lighthouse 13.6.0. Os perfis padrão do Lighthouse foram usados para mobile e desktop; as configurações completas de cada execução estão nos JSON. As 12 medições terminaram sem erros de execução ou avisos do Lighthouse.

| Página | Perfil | Performance | Acessibilidade | Boas práticas | SEO | LCP mediano | CLS mediano | TBT mediano |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Início | Mobile | 96 | 100 | 100 | 100 | 2.636 ms | 0 | 75 ms |
| Início | Desktop | 100 | 100 | 100 | 100 | 570 ms | 0,00017 | 0 ms |
| Detalhe | Mobile | 97 | 100 | 100 | 100 | 2.603 ms | 0 | 37 ms |
| Detalhe | Desktop | 100 | 100 | 100 | 100 | 546 ms | 0,00018 | 0 ms |

Os valores são medianas de três execuções. As pontuações individuais de Performance foram 96/96/97 para início mobile, 97/97/97 para detalhe mobile e 100/100/100 para cada página desktop. As metas do desafio são 90 para Performance, 95 para Acessibilidade e Boas práticas e 90 para SEO; todas as medianas desta coleta as atingiram.

Os resultados individuais estão nos 12 arquivos HTML e 12 JSON desta pasta; [summary.json](summary.json) contém as medições, horários, configurações e medianas. Os relatórios anteriores executados em preview local permanecem em [reports/lighthouse](../lighthouse/README.md). A diferença entre as coletas pode refletir condições e métodos de execução distintos; ela não estabelece uma causa única para a variação das pontuações.

A nota automática de acessibilidade não substitui uma revisão manual e não invalida as medições específicas que encontraram contraste abaixo de 4,5:1 no hero mobile. A aplicação usa MSW e service worker, condição que pode afetar a medição de transferência de recursos; veja as limitações documentadas na auditoria local. Os dados são resultados de laboratório na URL pública, não uma medição de usuários reais.
