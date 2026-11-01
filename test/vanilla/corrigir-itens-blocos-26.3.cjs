// Traduz referências herdadas da tabela 26.1 pelo nome, nunca pela posição.
// Os drops de blocos novos não são alterados: sua origem não é comprovada.
const fs = require('node:fs')
const path = require('node:path')
const pc = path.resolve(__dirname, '../../data/pc')
const read = (v, f) => JSON.parse(fs.readFileSync(path.join(pc, v, `${f}.json`), 'utf8'))
const oldItems = new Map(read('26.1', 'items').map(i => [i.id, i.name]))
const newItems = new Map(read('26.3', 'items').map(i => [i.name, i.id]))
const oldBlocks = new Map(read('26.1', 'blocks').map(b => [b.name, b]))
const blocks = read('26.3', 'blocks')
const materials = read('26.3', 'materials')
function translate (id) {
  const name = oldItems.get(Number(id))
  if (!name || !newItems.has(name)) throw new Error(`Item 26.1 sem correspondente: ${id} ${name}`)
  return newItems.get(name)
}
// Recusar uma segunda execução em vez de traduzir IDs já traduzidos.
if (blocks.find(b => b.name === 'stone').drops[0] !== 35 || !materials['mineable/pickaxe']['914']) {
  throw new Error('A entrada não é a tabela antiga esperada; nenhuma alteração foi gravada')
}
for (const block of blocks) {
  const old = oldBlocks.get(block.name)
  if (old) {
    if (JSON.stringify(block.drops || []) !== JSON.stringify(old.drops || [])) throw new Error(`Drops divergentes: ${block.name}`)
    block.drops = (block.drops || []).map(translate)
  }
  if (block.harvestTools) {
    block.harvestTools = Object.fromEntries(Object.entries(block.harvestTools).map(([id, value]) => [translate(id), value]))
  }
}
for (const [name, tools] of Object.entries(materials)) {
  materials[name] = Object.fromEntries(Object.entries(tools).map(([id, value]) => [translate(id), value]))
}
for (const [name, value] of [['blocks', blocks], ['materials', materials]]) {
  fs.writeFileSync(path.join(pc, '26.3', `${name}.json`), JSON.stringify(value, null, 2) + '\n')
}
