import { readFile } from 'node:fs/promises'

const manifest = JSON.parse(await readFile('docs/visual-verification/comparisons.json', 'utf8'))
const required = Array.from({ length: 15 }, (_, index) => `F${String(index + 1).padStart(2, '0')}`)
const pending = required.filter((id) => {
  const matches = manifest.comparisons.filter((entry) => entry.id === id)
  return matches.length !== 1 || matches[0].status !== 'approved'
})
if (pending.length) {
  console.error(`Fidelidade visual ainda não aprovada: ${pending.join(', ')}. Os diffs gerados são evidência para revisão, não baselines aprovadas.`)
  process.exitCode = 1
} else {
  // A status flag alone is not a regression test. Approved baselines and their
  // comparisons must be implemented before this command can report success.
  console.error('Os estados foram aprovados, mas a verificação das baselines versionadas ainda precisa ser implementada.')
  process.exitCode = 1
}
