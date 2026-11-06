import type { NFT } from '../shared/contracts'

export const CATEGORIES = [
  'Arte digital', 'Fotografia', 'Música', 'Arte 3D', 'Colecionáveis',
  'Generativa', 'Jogos', 'Assinaturas', 'Utilidade',
] as const
export const NETWORKS = ['ethereum', 'polygon', 'solana'] as const
const assets = {
  emerald: '/assets/nft/8459204731e6eba9d474cbc8ebc37071360d3ba5.webp',
  nomad: '/assets/nft/2986a7cb16d09de8970824d2dd58bf0bb021702c.webp',
  vessel: '/assets/nft/9df2ff42dd27ba657621c304557d1a855a4be6a5.webp',
  golden: '/assets/nft/87580f2def9af0ce13f4b6f6ce17bb2449bcfc16.webp',
} as const

const originals = [
  { id: 'emerald-ape-042', name: 'Emerald Ape #042', tokenId: '#0042', price: '1.19', art: assets.emerald },
  { id: 'sage-nomad-009', name: 'Sage Nomad #009', tokenId: '#0009', price: '1.69', art: assets.nomad },
  { id: 'neon-vessel-552', name: 'Neon Vessel #552', tokenId: '#0552', price: '1.99', art: assets.vessel },
  { id: 'cosmic-bloom-118', name: 'Cosmic Bloom #118', tokenId: '#0118', price: '1.29', art: assets.nomad },
  { id: 'violet-nomad-314', name: 'Violet Nomad #314', tokenId: '#0314', price: '1.39', art: assets.nomad },
  { id: 'ivory-baron-088', name: 'Ivory Baron #088', tokenId: '#0088', price: '1.79', art: assets.vessel },
  { id: 'golden-beat-207', name: 'Golden Beat #207', tokenId: '#0207', price: '0.99', art: assets.golden },
  { id: 'golden-signal-160', name: 'Golden Signal #160', tokenId: '#0160', price: '0.39', art: assets.golden },
] as const

/** Extra records are deterministic fixtures for filtering and pagination, not new art. */
export function createCatalogSeed(): NFT[] {
  return Array.from({ length: 36 }, (_, index) => {
    const original = originals[index % originals.length]
    const copy = index >= originals.length
    const tokenId = copy ? `#${String(1000 + index).padStart(4, '0')}` : original.tokenId
    const name = copy ? `${original.name.split(' #')[0]} ${tokenId}` : original.name
    return {
      id: copy ? `${original.id}-fixture-${index}` : original.id,
      tokenId, name, category: CATEGORIES[index % CATEGORIES.length],
      network: NETWORKS[index % NETWORKS.length], collection: 'Kurio Apes',
      attributes: index === 0 ? ['Óculos', 'Esmeralda', 'Raro'] : [],
      artUrl: original.art,
      gallery: Array.from({ length: 4 }, (_, image) => ({ id: `image-${image + 1}`, url: original.art, alt: name })),
      description: index === 0 ? 'Um colecionável digital 1/50 finalizado à mão da coleção Kurio Editions, verificado na Ethereum.' : '', rating: 4.8, ratingCount: index === 0 ? 19 : 1 + index,
      createdAt: new Date(Date.UTC(2026, 6, 29) - index * 86400000).toISOString(), version: 1,
      editions: [
        { id: 'one-of-one', label: '1/1', unitPrice: original.price, available: 1, version: 1 },
        { id: 'one-of-ten', label: '1/10', unitPrice: original.price, available: 10, version: 1 },
        { id: 'one-of-fifty', label: '1/50', unitPrice: original.price, available: 50, version: 1 },
        { id: 'open', label: 'ABERTA', unitPrice: original.price, available: 100, version: 1 },
      ],
    }
  })
}
