const { test } = require('node:test')
const assert = require('node:assert/strict')
const oldItems = require('../data/pc/26.1/items.json')
const newItems = require('../data/pc/26.3/items.json')
const oldBlocks = require('../data/pc/26.1/blocks.json')
const blocks = require('../data/pc/26.3/blocks.json')
const materials = require('../data/pc/26.3/materials.json')
const oldNames = new Map(oldItems.map(i => [i.id, i.name]))
const newIds = new Map(newItems.map(i => [i.name, i.id]))
const byName = new Map(blocks.map(b => [b.name, b]))

test('drops herdados referem-se aos mesmos nomes de itens da 26.1', () => {
  for (const old of oldBlocks) {
    const current = byName.get(old.name)
    if (!current) continue
    const expected = (old.drops || []).map(id => {
      const name = oldNames.get(id)
      assert.ok(newIds.has(name), `item ausente para ${old.name}: ${id}`)
      return newIds.get(name)
    })
    assert.deepEqual(current.drops, expected, old.name)
  }
})

test('pedra exige picaretas reais e deixa pedregulho', () => {
  const stone = byName.get('stone')
  assert.ok(stone.harvestTools[newIds.get('diamond_pickaxe')])
  assert.ok(stone.harvestTools[newIds.get('wooden_pickaxe')])
  assert.deepEqual(stone.drops, [newIds.get('cobblestone')])
  assert.deepEqual(byName.get('dirt').drops, [newIds.get('dirt')])
})

test('velocidades de materiais apontam para ferramentas 26.3', () => {
  assert.equal(materials['mineable/pickaxe'][newIds.get('diamond_pickaxe')], 8)
  assert.equal(materials['mineable/shovel'][newIds.get('diamond_shovel')], 8)
  assert.equal(materials['mineable/axe'][newIds.get('diamond_axe')], 8)
})
