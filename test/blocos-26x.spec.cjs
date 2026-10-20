// GUARDA DO REGISTRO DE BLOCOS DA 26.3
//
// ─────────────────────────────────────────────────────────────────────────────
// O QUE ESTÁ SENDO GUARDADO
//
// `data/pc/26.3/blocks.json` era uma cópia da 26.2: faltavam 118 blocos que a
// 26.3 registra (a família do `poplar`, `sulfur`, `cinnabar`, as escadas e
// lajes de lã e de concreto...). Como o id de um bloco é a POSIÇÃO dele no
// registro, e o blockstate id é a soma das contagens de estado dos blocos
// anteriores, a ausência desloca TODO id a partir do primeiro buraco.
//
// O sintoma para o usuário não é crash nenhum: o chunk traz o BLOCKSTATE ID e
// o minecraft-data traduz esse número em nome de bloco pela tabela
// (`blocksByStateId`, montada com `minStateId`..`maxStateId`). Com a tabela
// deslocada, o bot lê o nome do bloco ERRADO — e a CAIXA DE COLISÃO errada
// junto, porque ela sai da mesma tabela. Daí o relato: "o bot considera
// blocos tipo grama, blocos que deveria atravessar como bloco sólido".
//
// Medido: com a tabela antiga, o servidor mandava o state id 28 e a tabela
// dizia `bamboo_mosaic` (o vanilla diz `bamboo_planks`); o `dirt` do jogo
// estava no state id 10 e a tabela dizia 9 — onde o vanilla põe o
// `grass_block` sem neve. Ou seja: o bot via o chão como `dirt` quando era
// grama, e via neve como sei-lá-quê.
//
// ─────────────────────────────────────────────────────────────────────────────
// DE ONDE VEM A VERDADE (e por que não é dedução)
//
// A ordem numérica não está em lugar nenhum do JSON do servidor: desde
// 1.20.5 o registro de blocos vai por nome e o id continua sendo POSIÇÃO na
// ordem de registro. A fonte autoritativa é o próprio servidor vanilla: o
// `BuiltInRegistries.BLOCK`, que o bootstrap do vanilla preenche.
//
// Medido no jar do servidor 26.3 do dono (`javap`+bootstrap, o mesmo código
// que o jogo usa): 1286 blocos e 35723 estados. O `Block.getId()` de cada
// bloco, o `StateDefinition` de cada um e a CAIXA DE COLISÃO de cada estado
// (`getCollisionShape`) saem dali — e é essa medição que a âncora congela.
//
// A caixa de colisão foi conferida contra a tabela antiga ANTES de mudar
// qualquer coisa: 1168 de 1168 blocos batem exatamente (a convenção do
// `blockCollisionShapes.json` é a forma de colisão do vanilla, por estado).
//
// ⚠️ ESTA GUARDA DEPENDE DE ANCORAGEM EXTERNA: ela prova que o arquivo bate
// com a medição de um servidor 26.3, numa data. Se a 26.3 real mudar, a
// guarda fica desatualizada e a re-extração do jar é o caminho — ela não
// descobre sozinha que envelheceu, e não finge que descobre.

const assert = require('node:assert')
const { test } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

const RAIZ = path.join(__dirname, '..')
const PASTA = path.join(RAIZ, 'data', 'pc', '26.3')
const ARQUIVO = path.join(PASTA, 'blocks.json')
const ARQUIVO_FORMAS = path.join(PASTA, 'blockCollisionShapes.json')
const ancoragem = JSON.parse(fs.readFileSync(path.join(__dirname, 'blocos-26.3-medido.json'), 'utf8'))
const blocos = JSON.parse(fs.readFileSync(ARQUIVO, 'utf8'))
const formas = JSON.parse(fs.readFileSync(ARQUIVO_FORMAS, 'utf8'))

function sha (linhas) {
  return crypto.createHash('sha256').update(linhas.join('\n')).digest('hex')
}

/** id -> nome, na mesma forma canonica usada para o sha da ancoragem. */
function mapaDe (lista) {
  const mapa = {}
  for (const b of lista) {
    if (!b) continue
    mapa[b.id] = b.name
  }
  return mapa
}

const mapa = mapaDe(blocos)
const porNome = new Map(blocos.filter(b => b && b.name).map(b => [b.name, b]))
const idsOrdenados = Object.keys(mapa).map(Number).sort((a, b) => a - b)

test('a tabela tem uma entrada por bloco registrado, sem buraco', () => {
  assert.strictEqual(blocos.length, ancoragem.total,
    'a tabela tem ' + blocos.length + ' blocos e o registro da 26.3 tem ' + ancoragem.total)
  assert.strictEqual(idsOrdenados[0], 0, 'a tabela não começa em 0')
  assert.strictEqual(idsOrdenados[idsOrdenados.length - 1], ancoragem.total - 1,
    'o maior id é ' + idsOrdenados[idsOrdenados.length - 1] + ' e o medido é ' + (ancoragem.total - 1))
  for (let i = 0; i < idsOrdenados.length; i++) {
    assert.strictEqual(idsOrdenados[i], i,
      'buraco na sequência: a posição ' + i + ' tem o id ' + idsOrdenados[i])
  }
})

test('nenhuma entrada vazia ou sem nome', () => {
  const vazias = blocos
    .map((b, i) => ({ b, i }))
    .filter(({ b }) => !b || typeof b !== 'object' || !b.name)
    .map(({ b, i }) => 'posição ' + i + ': ' + JSON.stringify(b))
  assert.deepStrictEqual(vazias, [], 'entradas sem nome na tabela:\n  ' + vazias.join('\n  '))
})

test('o mapa id -> nome inteiro bate com o medido no servidor 26.3', () => {
  // Esta é a asserção que reprova a cópia deslocada: qualquer id que deslize
  // muda o sha, e a mensagem diz qual nome ocupa o lugar errado.
  assert.strictEqual(sha(idsOrdenados.map(id => id + '=' + mapa[id])), ancoragem.shaMapa,
    'o mapa de blocos não bate com o registro medido no servidor 26.3 — ' +
    'se faltar um bloco no meio, todos os ids seguintes deslizam')
})

test('o layout de estados bate com o medido no servidor 26.3', () => {
  // O state id é o que o SERVIDOR manda no chunk. Se ele desliza, o bot lê o
  // nome do bloco errado — que é o defeito inteiro.
  const linhas = blocos
    .slice()
    .sort((a, b) => a.id - b.id)
    .map(b => b.name + '=' + b.minStateId + '..' + b.maxStateId + '#' + b.defaultState)
  assert.strictEqual(sha(linhas), ancoragem.shaEstados,
    'o layout de estados não bate com o medido no servidor 26.3 — ' +
    'o bot passaria a ler o nome do bloco errado para cada bloco do mundo')
})

test('os state ids são contíguos e sem sobreposição', () => {
  // A consistência interna: os state ids dos blocos formam uma sequência
  // sem buraco a partir do 0. Uma tabela com um bloco faltando quebraria
  // isto — e é por isso que a medição externa é indispensável.
  const ordenados = blocos.slice().sort((a, b) => a.id - b.id)
  let esperado = 0
  for (const b of ordenados) {
    assert.strictEqual(b.minStateId, esperado,
      b.name + ' começa no state id ' + b.minStateId + ' e o anterior terminou em ' + (esperado - 1))
    assert.ok(b.maxStateId >= b.minStateId, b.name + ' tem maxStateId menor que minStateId')
    assert.ok(b.defaultState >= b.minStateId && b.defaultState <= b.maxStateId,
      b.name + ' tem defaultState ' + b.defaultState + ' fora de ' + b.minStateId + '..' + b.maxStateId)
    esperado = b.maxStateId + 1
  }
  assert.strictEqual(esperado, ancoragem.totalEstados,
    'o total de estados é ' + esperado + ' e o medido é ' + ancoragem.totalEstados)
})

test('a contagem de estados de cada bloco bate com as suas propriedades', () => {
  const erradas = []
  for (const b of blocos) {
    let n = 1
    for (const p of b.states || []) n *= p.num_values
    if (n !== b.maxStateId - b.minStateId + 1) {
      erradas.push(b.name + ': propriedades=' + n + ' estados=' + (b.maxStateId - b.minStateId + 1))
    }
  }
  assert.deepStrictEqual(erradas, [], 'contagem de estados errada:\n  ' + erradas.join('\n  '))
})

test('as testemunhas nomeadas continuam nos ids medidos', () => {
  const erradas = []
  for (const [nome, medido] of Object.entries(ancoragem.testemunhas)) {
    const real = porNome.get(nome)
    if (!real) { erradas.push(nome + ': não existe na tabela'); continue }
    for (const campo of ['id', 'minStateId', 'maxStateId', 'defaultState']) {
      if (real[campo] !== medido[campo]) {
        erradas.push(nome + '.' + campo + ' = ' + real[campo] + ', medido ' + medido[campo])
      }
    }
  }
  assert.deepStrictEqual(erradas, [], 'blocos fora do id medido:\n  ' + erradas.join('\n  '))
})

test('a grama e a neve continuam sendo blocos atravessáveis', () => {
  // A afirmação pelo NOME, para não depender de o sha estar certo: é o
  // sintoma que o dono descreveu ("grama, blocos que deveria atravessar").
  const atravessaveis = ['short_grass', 'tall_grass', 'snow', 'water', 'torch', 'vine']
  for (const nome of atravessaveis) {
    const b = porNome.get(nome)
    assert.ok(b, nome + ' não existe na tabela')
    assert.strictEqual(b.boundingBox, 'empty',
      nome + ' tem boundingBox=' + b.boundingBox + ' e o medido é empty (atravessável)')
    const forma = formas.blocks[nome]
    const id = Array.isArray(forma) ? forma[0] : forma
    assert.deepStrictEqual(formas.shapes[String(id)], [],
      nome + ' tem caixa de colisão ' + JSON.stringify(formas.shapes[String(id)]) + ' e o medido é []')
  }
})

test('a parede continua sendo sólida', () => {
  for (const nome of ['stone', 'cobblestone', 'oak_planks', 'wall', 'glass']) {
    const b = porNome.get(nome)
    if (!b) continue
    assert.strictEqual(b.boundingBox, 'block', nome + ' tem boundingBox=' + b.boundingBox)
  }
})

test('os 118 blocos que faltavam existem, com o estado medido', () => {
  // A lista é a diferença entre o registro medido e a cópia da 26.2. Cada um
  // deles, se ausente, desloca todo id depois dele.
  const novos = [
    'poplar_planks', 'poplar_sapling', 'poplar_log', 'stripped_poplar_log',
    'poplar_wood', 'stripped_poplar_wood', 'red_poplar_leaves',
    'orange_poplar_leaves', 'yellow_poplar_leaves', 'straw_bed', 'red_shrub',
    'poplar_shelf', 'poplar_sign', 'poplar_wall_sign', 'poplar_hanging_sign',
    'poplar_wall_hanging_sign', 'poplar_pressure_plate', 'poplar_trapdoor',
    'shelf_mushroom', 'potted_poplar_sapling', 'poplar_button', 'poplar_stairs',
    'poplar_slab', 'poplar_fence_gate', 'poplar_fence', 'poplar_door',
    'sulfur', 'potent_sulfur', 'sulfur_slab', 'sulfur_stairs', 'sulfur_wall',
    'polished_sulfur', 'polished_sulfur_slab', 'polished_sulfur_stairs',
    'polished_sulfur_wall', 'sulfur_bricks', 'sulfur_brick_slab',
    'sulfur_brick_stairs', 'sulfur_brick_wall', 'chiseled_sulfur',
    'cinnabar', 'cinnabar_slab', 'cinnabar_stairs', 'cinnabar_wall',
    'polished_cinnabar', 'polished_cinnabar_slab', 'polished_cinnabar_stairs',
    'polished_cinnabar_wall', 'cinnabar_bricks', 'cinnabar_brick_slab',
    'cinnabar_brick_stairs', 'cinnabar_brick_wall', 'chiseled_cinnabar',
    'sulfur_spike'
  ]
  const faltando = novos.filter(nome => !porNome.has(nome))
  assert.deepStrictEqual(faltando, [],
    'blocos que a 26.3 registra e a tabela não tem — cada um desloca os ids depois dele:\n  ' +
    faltando.join('\n  '))
  // e as escadas/lajes de lã e de concreto, que são 64 no total
  const families = []
  for (const nome of porNome.keys()) {
    if (/_(wool|concrete)_(stairs|slab)$/.test(nome)) families.push(nome)
  }
  assert.strictEqual(families.length, 64,
    'as famílias de escada/laje de lã e de concreto têm ' + families.length + ' blocos e o medido é 64')
})

test('todo bloco tem forma de colisão, e toda forma usada existe', () => {
  const semForma = blocos.filter(b => formas.blocks[b.name] === undefined).map(b => b.name)
  assert.deepStrictEqual(semForma, [],
    'blocos sem forma de colisão — o prismarine-block deixaria `shapes` indefinido ' +
    'e o physics quebraria ao iterar:\n  ' + semForma.join('\n  '))

  const usadas = new Set()
  for (const nome of Object.keys(formas.blocks)) {
    const v = formas.blocks[nome]
    for (const id of (Array.isArray(v) ? v : [v])) usadas.add(String(id))
  }
  const inexistentes = [...usadas].filter(id => formas.shapes[id] === undefined)
  assert.deepStrictEqual(inexistentes, [],
    'formas usadas e inexistentes:\n  ' + inexistentes.join('\n  '))
})

test('a forma de colisão bate com a medida do servidor 26.3', () => {
  const linhas = Object.keys(formas.blocks).sort()
    .map(nome => nome + '=' + JSON.stringify(formas.blocks[nome]))
  assert.strictEqual(sha(linhas), ancoragem.shaFormas,
    'a tabela de caixas de colisão não bate com a medição do servidor 26.3')
})

test('o runtime resolve o state id do servidor para o bloco certo', () => {
  // O teste acima prova o ARQUIVO. Este prova o CAMINHO: é o `blocksByStateId`
  // que o prismarine-chunk e o prismarine-physics usam, e é ele que traduz o
  // número que o servidor mandou no chunk.
  const mcData = require('minecraft-data')('26.3')
  const esperado = {
    8: 'grass_block',   // o chão de grama
    9: 'grass_block',   // ... sem neve (o estado padrão)
    10: 'dirt',
    27: 'poplar_planks',
    28: 'bamboo_planks'
  }
  for (const [stateId, nome] of Object.entries(esperado)) {
    const b = mcData.blocksByStateId[Number(stateId)]
    assert.ok(b, 'o state id ' + stateId + ' não resolve para nenhum bloco')
    assert.strictEqual(b.name, nome,
      'o state id ' + stateId + ' resolveu para ' + b.name + ' e o medido é ' + nome)
  }
  // e o inverso: a neve e a grama são atravessáveis no runtime
  for (const nome of ['short_grass', 'snow']) {
    const b = mcData.blocksByName[nome]
    assert.ok(b, nome + ' não existe no minecraft-data')
    assert.strictEqual(b.boundingBox, 'empty', nome + ' não é atravessável no runtime')
  }
})
