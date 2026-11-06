# Ambiente e dependências

Fixado em `.nvmrc`: Node 24.22.1. npm 11.19.1 está fixado em `packageManager` e `engines`. Versões diretas abaixo são as registradas no lockfile e observadas na instalação local.

| Pacote | Versão | Engines | Peer dependencies |
| --- | --- | --- | --- |
| @fontsource-variable/roboto-mono | 5.3.0 | — | — |
| @mswjs/interceptors | 0.44.0 | node: >=22 | — |
| @mswjs/socket.io-binding | 0.2.0 | — | msw: ^2.10.2 |
| @playwright/test | 1.64.1 | node: >=20 | — |
| @tailwindcss/vite | 4.3.4 | — | vite: ^5.2.0 || ^6 || ^7 || ^8 |
| @tanstack/react-query | 5.106.1 | — | @types/react: ^18 || ^19; react: ^18 || ^19 |
| @tanstack/react-router | 1.170.46 | node: >=20.19 | react: >=18.0.0 || >=19.0.0; react-dom: >=18.0.0 || >=19.0.0 |
| @types/node | 24.19.2 | — | — |
| @types/react | 19.3.0 | — | — |
| @types/react-dom | 19.3.0 | — | @types/react: ^19.3.0 |
| @vitejs/plugin-react | 6.2.1 | node: ^20.19.0 || >=22.12.0 | @rolldown/plugin-babel: ^0.1.7 || ^0.2.0 || ^0.3.0; babel-plugin-react-compiler: ^1.0.0; oxc-transform-react: >=0.152.0 <0.157.0; vite: ^8.0.0 |
| axios | 1.21.0 | — | — |
| class-variance-authority | 0.7.1 | — | — |
| clsx | 2.1.1 | node: >=6 | — |
| fake-indexeddb | 6.2.7 | node: >=18 | — |
| lighthouse | 13.6.0 | node: >=22.19 | — |
| msw | 2.15.0 | node: >=18 | typescript: >= 4.8.x |
| oxlint | 1.91.0 | node: ^20.19.0 || >=22.12.0 | oxlint-tsgolint: >=7.0.2005; vite-plus: * |
| react | 19.3.1 | node: >=0.10.0 | — |
| react-dom | 19.3.1 | — | react: ^19.3.1 |
| socket.io-client | 4.8.4 | node: >=10.0.0 | — |
| tailwind-merge | 3.7.0 | — | — |
| tailwindcss | 4.3.4 | — | — |
| typescript | 7.0.2 | node: >=16.20.0 | — |
| vite | 8.3.6 | node: ^20.19.0 || >=22.12.0 | @types/node: ^20.19.0 || >=22.12.0; @vitejs/devtools: ^0.7.1 || ^0.8.0; esbuild: ^0.27.0 || ^0.28.0; jiti: >=1.21.0; less: ^4.0.0; sass: ^1.70.0; sass-embedded: ^1.70.0; stylus: >=0.54.8; sugarss: ^5.0.0; terser: ^5.16.0; tsx: ^4.8.1; yaml: ^2.4.2 |
| zod | 4.6.7 | — | — |

Em 2026-11-05, uma cópia limpa sem `node_modules` foi verificada com Node 24.22.1 e npm 11.19.1: `npm ci`, `npm ls --depth=0`, `npm run typecheck`, `npm run lint` e `npm run build` terminaram com sucesso. O npm informou que os scripts de instalação de `fsevents` e `msw` não estavam cobertos por `allowScripts`; as verificações acima passaram com a política padrão do npm. Uma tentativa anterior havia falhado por falta de espaço em disco.
