# Investigação do binding Socket.IO

Em 2026-11-05, o pacote instalado `@mswjs/socket.io-binding@0.2.0` expõe `toSocketIo`, enquanto o desenho da change cita uma classe `SocketIo`. O código e o README instalados mostram a API `toSocketIo(connection)` e geração de handshake no wrapper. Essa diferença precisa ser refletida no desenho antes da integração definitiva.

Um ensaio isolado em Node com `msw@2.15.0`, `socket.io-client@4.8.4`, transporte WebSocket e o wrapper não concluiu o handshake dentro de três segundos. A investigação identificou que o MSW remove o prefixo `/socket.io/` antes de comparar a URL do handler; portanto, o link deve corresponder à origem WebSocket. Em Chromium, `tests/e2e/socket-probe.spec.ts` comprovou handshake e troca de evento usando `toSocketIo(connection)`, com o cliente importado após iniciar MSW. Essa prova isolada ainda não cobre autenticação, eventos de domínio, reconexão nem build de preview; nenhuma tarefa de Socket.IO foi marcada como concluída.
