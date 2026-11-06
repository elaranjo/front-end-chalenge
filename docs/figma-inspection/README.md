# Inspeção do Figma do desafio NFT Marketplace

Inspeção realizada em **5 de novembro de 2026**, antes da proposta e da implementação. Todos os **15 frames da página pública** foram conferidos visualmente: nove desktop e seis mobile. O levantamento registra composição, medidas, componentes, textos, ações representadas, instruções presentes no arquivo, assets e divergências com o enunciado.

O design não fecha sozinho todos os requisitos funcionais. Há instruções úteis nas descrições dos componentes, mas não há conexões de protótipo nos 15 frames. Existem lacunas de responsividade e estados, além de conflitos de dados e de composição. **Inspeção concluída não significa que esses conflitos estejam resolvidos ou que a implementação já esteja validada como pixel perfect.**

Os pontos de maior impacto são o subtotal incorreto do carrinho mobile (linhas somam 8.14 ETH e o desenho informa 8.92 ETH), tokens e imagens inconsistentes entre telas, ausência de dados/revisão no checkout mobile, falta de referências de tablet e de três telas mobile, e ausência dos estados pendente/recusado. O registro detalhado contém **12 conflitos, 27 lacunas e 11 diferenças visuais que não devem ser uniformizadas automaticamente**.

## Fontes e evidências

- [Figma original](https://www.figma.com/design/Ff0SksUi7UFtPWUO8kyNtw/Frontend-Challenge?node-id=0-1), página `Marketplace de NFTs GreenMint`. A marca desenhada é **KURIO**.
- [Enunciado do teste](../../README.md), especialmente seções 1, 3, 6, 7, 8 e 9.
- [Cópia usada para inspeção](https://www.figma.com/design/kChvpMLrhHxfKHjyzqWV3B/Frontend-Challenge--Copy-?node-id=0-1), criada pela opção permitida “Duplicate to your drafts”. Não foram alteradas suas camadas. Comentários foram consultados no original.
- [Exportação original preservada](source/frontend-challenge.fig), obtida por “Save local copy”, e [metadados da exportação](data/source-meta.json). Exportação de 2026-11-05 às 18:53:15 UTC, equivalentes a 15:53:15 em São Paulo.
- [Medidas e contagens obtidas pela API](data/frames.json), [dados das 2.009 entradas do arquivo](data/source-nodes.json) e [conferência de cobertura](data/coverage.json).

Os nomes de camadas nem sempre acompanham o texto visível. Por exemplo, a camada `3:107` mantém o nome inglês, mas seu conteúdo é “SEJA DONO DO FUTURO / DA ARTE DIGITAL”. Os textos de `textData.characters`, a composição renderizada e as propriedades efetivas precisam ser consultados em conjunto.

## Leitura do levantamento

| Documento | Conteúdo |
| --- | --- |
| [Frames](frames.md) | Inspeção individual dos 15 frames, conteúdo, medidas e diferenças entre versões |
| [Componentes e assets](components-and-assets.md) | Componentes compartilhados, instruções documentadas, imagens, fontes, cores e limites da extração |
| [Navegação e comportamento](navigation-and-behavior.md) | Ações desenhadas, comportamento exigido, destinos inferidos e lacunas |
| [Lacunas e conflitos](gaps-and-conflicts.md) | Divergências rastreáveis com o Figma e o README, sem decisões silenciosas |
| [Inventário de camadas](layer-inventory.md) | Hierarquia até o terceiro nível, posições, dimensões, textos próprios e referências de componentes |
| [Cobertura inicial de instâncias](data/frame-instance-coverage.json) | Instâncias diretamente presentes nos 15 frames e candidatos de assets por vínculo de nó; exige revisão manual |

## Cobertura dos frames

Dimensões em pixels. As pequenas frações provenientes do arquivo foram arredondadas na tabela; os valores completos estão em `data/frames.json`.

| Frame | ID | Dimensões | Inspeção visual |
| --- | --- | --- | --- |
| Desktop / Início | `2:2` | 1440 × 3668 | Concluída |
| Desktop / Detalhes do NFT | `10:244` | 1440 × 2246 | Concluída |
| Desktop / Carrinho de NFTs | `11:1278` | 1440 × 1754 | Concluída |
| Desktop / Pagamento | `11:2862` | 1440 × 1657 | Concluída |
| Desktop / Confirmação de Pedido | `11:4385` | 1440 × 1657 | Concluída |
| Desktop / Login | `9:115` | 1440 × 1981 | Concluída |
| Desktop / Cadastro | `9:1022` | 1440 × 1981 | Concluída |
| Desktop / Perfil do Colecionador | `9:1238` | 1440 × 1080 | Concluída |
| Desktop / Carteiras | `9:1670` | 1440 × 1080 | Concluída |
| Mobile / Início | `14:5226` | 414 × 896 | Concluída |
| Mobile / Detalhes do NFT | `15:5536` | 414 × 896 | Concluída |
| Mobile / Carrinho de NFTs | `16:360` | 414 × 896 | Concluída |
| Mobile / Pagamento | `16:748` | 414 × 896 | Concluída |
| Mobile / Login | `16:1022` | 414 × 896 | Concluída |
| Mobile / Cadastro | `16:1228` | 414 × 896 | Concluída |

## Como interpretar a evidência

1. **Desenho verificado:** elementos e medidas vistos no frame ou no arquivo exportado.
2. **Instrução do arquivo:** descrição de componente ou variável; não deve ser confundida com uma sugestão feita em comentário.
3. **Requisito do enunciado:** comportamento obrigatório, mesmo quando falta desenho.
4. **Inferência:** associação provável entre um controle e seu destino; não é uma conexão de protótipo existente.
5. **Lacuna ou conflito:** informação ausente ou incompatível que precisa ser tratada na proposta, sem inventar uma solução como se estivesse no Figma.

O conector recusou a leitura do original por falta de edição. Na cópia, a leitura funcionou e confirmou medidas e ausência de conexões, mas atingiu o limite do plano Starter durante a extração detalhada. A continuação usou a exportação local e a inspeção visual no navegador. A API também recusou acesso às annotations; portanto, não se afirma que annotations privadas inexistam. As descrições de componentes e os comentários públicos acessíveis foram examinados.

O `.fig` foi decodificado localmente com o schema Kiwi embutido no próprio arquivo, usando `kiwi-schema` e descompressão Deflate/Zstandard. Referências técnicas: [Kiwi, do autor do formato](https://github.com/evanw/kiwi) e [implementação consultada de leitura de .fig](https://github.com/sunyui/figma-parser/blob/main/scripts/decode_kiwi.cjs). O JSON anexado remove dados de edição de usuários, glyphs e comandos binários de geometria; o `.fig` preservado mantém a fonte integral. Instâncias continuam referenciando componentes e overrides, não foram convertidas em uma árvore achatada de pixels.

O inventário de instâncias pode ser atualizado com `node scripts/inventory-figma-instances.mjs`. Na análise atual, 69 instâncias aparecem diretamente nos frames e 19 não têm candidato identificado por correspondência automática de ID, por outra instância da mesma definição ou por grupo pequeno que contém a definição. Essa lista inclui componentes compostos e usos repetidos: não representa uma contagem de ícones ausentes. A expansão das definições encontrou 38 ocorrências aninhadas de 11 símbolos, sem definições ausentes ou ciclos; ela ainda não resolve visibilidade, transformações e overrides propagados. Um candidato por ancestral, símbolo compartilhado ou grupo não comprova que o asset contém a geometria adequada. A cobertura efetiva continua pendente de conferência antes do G02.

As dimensões de **todos os 15 frames** no binário coincidem com a leitura independente da API. Não foi criada aplicação, proposta OpenSpec, rota, componente React ou teste nesta etapa.

A [validação do levantamento](data/inspection-validation.json) confirmou os 15 registros individuais, as 15 correspondências de dimensão, os quatro hashes/dimensões de imagens, o hash da fonte e a ausência de links locais quebrados. Os arquivos de dependências usados na decodificação ficaram fora do repositório da aplicação.
