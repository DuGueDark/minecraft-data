// GUARDA DO REGISTRO DE ITENS DA 26.2
//
// ─────────────────────────────────────────────────────────────────────────────
// O QUE ESTÁ SENDO GUARDADO
//
// O `data/pc/26.2/` foi criado copiando o `data/pc/26.1/`. O `items.json` ficou
// como a cópia — sha 1c194aea3a, id a id idêntico — e a 26.2 real tem itens que a
// 26.1 não tem, inseridos em dois pontos do registro. O sintoma para o usuário
// não é um crash: é o inventário mostrar o item ERRADO, e nada no código
//dá o aviso. Por isso a guarda existe.
//
// ─────────────────────────────────────────────────────────────────────────────
// POR QUE UM SHA E NÃO SÓ UMA ASSERÇÃO DE ESTADO
//
// A versão anterior do `items.json` da 26.2 era um arquivo válido, bem formado,
// com 1506 entradas e ids 0..1505 contíguos. Qualquer asserção de sanidade
// passava nele. O que reprova a cópia é a COMPARAÇÃO COM O SERVIDOR, e o jeito
// de levar essa comparação para dentro do repositório é ancorar no que foi
// medido: o sha do mapa id -> nome inteiro, mais testemunhas nomeadas.
//
// A consequência pretendida: se alguém voltar a copiar o da 26.1, a guarda
// reprova dizendo qual nome mudou de id. Se um id deslizar, reprova dizendo
// onde.
//
// ⚠️ ESTA GUARDA DEPENDE DE UMA ANCORAGEM EXTERNA. Ela prova que o arquivo bate
// com a medição de UM servidor, numa data. Se a 26.2 real mudar (ela é um número
// de versão que anda), a guarda passa a estar desatualizada e a re-sondagem é o
// caminho. Ela não descobre sozinha que ficou velha — e não finge que descobre.

const assert = require('node:assert')
const { test } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

const RAIZ = path.join(__dirname, '..')
const BASE = path.join(RAIZ, 'data', 'pc')
const carregar = (v) => JSON.parse(fs.readFileSync(path.join(BASE, v, 'items.json'), 'utf8'))
const ancoragem = JSON.parse(fs.readFileSync(path.join(RAIZ, 'test', 'itens-26.2-medido.json'), 'utf8'))

const itens26 = carregar('26.2')
const itens261 = carregar('26.1')

/** Mapa id -> nome, na mesma forma canônica usada para o sha da ancoragem. */
function mapaDe (lista) {
  const mapa = {}
  for (const e of lista) {
    if (!e) continue
    mapa[e.id] = e.name
  }
  return mapa
}

function shaDoMapa (mapa) {
  const ids = Object.keys(mapa).map(Number).sort((a, b) => a - b)
  return crypto.createHash('sha256')
    .update(ids.map((id) => id + '=' + mapa[id]).join('\n'))
    .digest('hex')
}

test('o items.json da 26.2 tem o mesmo id que o SERVIDOR mediu', () => {
  const obtido = shaDoMapa(mapaDe(itens26))
  assert.strictEqual(
    obtido,
    ancoragem.shaMapa,
    'o mapa id->name da 26.2 diverge da medição do servidor.\n' +
    '  Provavelmente o items.json voltou a ser cópia do da 26.1 ' +
    '(sha 1c194aea3a, os MESMOS ids).\n' +
    '  O original rompido: stone=1, oak_planks=36, diamond_sword=937, cooked_beef=1112.\n' +
    '  O que o servidor manda:   stone=1, oak_planks=63, diamond_sword=964, cooked_beef=1140.\n' +
    '  Reancore com: node dzbot-platform/scripts/registro-itens-26.2.cjs (depois de re-sondar).'
  )
})

test('as testemunhas nomeadas batem, e dizem ONDE quando não batem', () => {
  const porNome = new Map(itens26.filter(Boolean).map((e) => [e.name, e.id]))
  const errados = []
  for (const [nome, id] of Object.entries(ancoragem.testemunhas)) {
    if (porNome.get(nome) !== id) errados.push(nome + ': arquivo diz ' + porNome.get(nome) + ', medido ' + id)
  }
  assert.deepStrictEqual(
    errados, [],
    'ids que não batem com a medição:\n  ' + errados.join('\n  ')
  )
})

test('air continua no id 0 e continua sendo air', () => {
  // O id 0 é semeado pela reconstrução, não medido: /give air não entrega nada. É a
  // única posição que a guarda aceita sem âncora — e ela exige que continue
  // sendo `air`, para que ninguém preencha o buraco com outra coisa.
  assert.ok(itens26[0], 'o id 0 está vazio; air deveria estar semeado')
  assert.strictEqual(itens26[0].name, 'air')
  assert.strictEqual(itens26[0].id, 0)
})

test('o registro é contíguo do 0 ao id máximo, sem buraco e sem id repetido', () => {
  const maxId = ancoragem.idMaximo
  assert.strictEqual(itens26.length, maxId + 1,
    'o array tem ' + itens26.length + ' posições mas o id máximo medido é ' + maxId)
  const buracos = []
  for (let i = 0; i <= maxId; i++) if (!itens26[i]) buracos.push(i)
  assert.deepStrictEqual(buracos, [], 'posições vazias: ' + buracos.join(', '))

  const vistos = new Set()
  const repetidos = []
  for (const e of itens26) {
    if (vistos.has(e.id)) repetidos.push(e.id)
    vistos.add(e.id)
  }
  assert.deepStrictEqual(repetidos, [], 'ids repetidos: ' + repetidos.join(', '))
})

test('NENHUM nome aparece em dois ids', () => {
  // Um id duplicado quebra o prismarine-registry inteiro e o sintoma aparece
  // longe da causa. Chega perto.
  const porNome = new Map()
  const dup = []
  for (const e of itens26) {
    if (porNome.has(e.name)) dup.push(e.name + ' (ids ' + porNome.get(e.name) + ' e ' + e.id + ')')
    else porNome.set(e.name, e.id)
  }
  assert.deepStrictEqual(dup, [], 'nomes duplicados: ' + dup.slice(0, 10).join('; '))
})

test('a 26.2 NÃO é cópia da 26.1 — e o motivo está na própria diferença', () => {
  // Esta é a asserção que reprova o defeito ORIGINAL. As de sanidade acima
  // passavam no arquivo quebrado: ele era válido, contíguo e sem repetidos.
  const nomes = new Set(itens261.map((e) => e.name))
  const movidos = itens26
    .filter((e) => nomes.has(e.name) && itens261.find((x) => x.name === e.name).id !== e.id)
    .map((e) => e.name + ': ' + itens261.find((x) => x.name === e.name).id + ' -> ' + e.id)
  assert.ok(
    movidos.length > 0,
    'nenhum item mudou de id em relação à 26.1. Ou a 26.2 voltou a ser cópia ' +
    'da 26.1 (o defeito original), ou a medição ancorada não é desta versão.'
  )
  // O deslocamento tem de ser POSITIVO e monotônico na maior parte: a 26.2 real
  // ganhou itens, não perdeu. Um deslocamento negativo indicaria que o arquivo
  // foi montado ao contrário.
  const deslocamentos = itens26
    .filter((e) => nomes.has(e.name))
    .map((e) => e.id - itens261.find((x) => x.name === e.name).id)
  const negativos = deslocamentos.filter((d) => d < 0)
  assert.deepStrictEqual(negativos, [],
    'itens andaram para TRÁS em relação à 26.1: ' + negativos.length + ' deles')
})

test('os campos que a 26.3 perdeu NÃO foram perdidos aqui', () => {
  // A 26.3 é mais pobre que a 26.1: sem maxDurability, repairWith nem
  // enchantCategories em boa parte dos itens. Montar a 26.2 a partir dela
  // trocaria um id errado por um id certo e um dado faltando. Esta asserção
  // existe para essa troca não passar em silêncio.
  const porNome = new Map(itens26.filter(Boolean).map((e) => [e.name, e]))
  const perdidos = []
  for (const antigo of itens261) {
    const novo = porNome.get(antigo.name)
    if (!novo) continue
    for (const campo of ['maxDurability', 'repairWith', 'enchantCategories']) {
      if (antigo[campo] !== undefined && novo[campo] === undefined) {
        perdidos.push(antigo.name + '.' + campo)
      }
    }
  }
  assert.deepStrictEqual(perdidos.slice(0, 10), [],
    'campos que a 26.1 tinha e a 26.2 perdeu: ' + perdidos.length + ' — ' + perdidos.slice(0, 10).join(', '))
})

test('displayName continua preenchido em todas as entradas', () => {
  const sem = itens26.filter((e) => e && !e.displayName).map((e) => e.name)
  assert.deepStrictEqual(sem.slice(0, 10), [],
    'entradas sem displayName: ' + sem.length + ' — ' + sem.slice(0, 10).join(', '))
})

test('o total de itens é o que a medição encontrou', () => {
  assert.strictEqual(itens26.filter(Boolean).length, ancoragem.total)
})
