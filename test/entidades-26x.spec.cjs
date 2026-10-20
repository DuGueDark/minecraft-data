// GUARDA DO REGISTRO DE ENTIDADES DA 26.3
//
// ─────────────────────────────────────────────────────────────────────────────
// O QUE ESTÁ SENDO GUARDADO
//
// `data/pc/26.3/entities.json` estava deslocado: faltavam quatro entidades que a
// 26.3 registra (`cushion`, `poplar_boat`, `poplar_chest_boat`, `sulfur_cube`),
// então TODO id a partir do 33 estava errado. O `player` real é 159 e o arquivo
// dizia 155 — e o `spawn_entity` do servidor manda 159 para jogador.
//
// O sintoma para o usuário não é crash nenhum. É o mineflayer gravar o jogador
// como "entidade sem registro": `bot.players['Fulano'].entity` fica NULL e todo
// plugin que precisa da posição dele responde "Não consegui ver sua posição".
// Foi exatamente assim que o `MiningPlugin` quebrou no 26.3. De quebra, bicho e
// item apareciam com nome e hitbox do vizinho de tabela.
//
// ─────────────────────────────────────────────────────────────────────────────
// DE ONDE VEM A VERDADE (e por que não é dedução)
//
// A ordem numérica não está em lugar nenhum do JSON do servidor: desde 1.20.5 o
// registro de entity type vai por nome e o id continua sendo POSIÇÃO na ordem de
// registro. A fonte autoritativa é a mesma que o jogo usa — o `<clinit>` de
// `net/minecraft/world/entity/EntityTypes.class`, que registra cada tipo lendo
// `EntityTypeIds.<NOME>` em ordem alfabética.
//
// Medido no `client-26.3.jar` do LabyMod (`javap -p -c`): 161 entradas, e
// `PLAYER` cai na posição 159. O wire confirmou: três jogadores distintos
// chegaram com `spawn_entity type=159`. Bytecode e pacote concordam, e é essa
// concordância que a âncora `entidades-26.3-medido.json` congela.
//
// ⚠️ ESTA GUARDA DEPENDE DE ANCORAGEM EXTERNA: ela prova que o arquivo bate com
// a medição de um client 26.3, numa data. Se a 26.3 real mudar, a guarda fica
// desatualizada e a re-extração do jar é o caminho — ela não descobre sozinha
// que envelheceu, e não finge que descobre.

const assert = require('node:assert')
const { test } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

const RAIZ = path.join(__dirname, '..')
const ARQUIVO = path.join(RAIZ, 'data', 'pc', '26.3', 'entities.json')
const ancoragem = JSON.parse(fs.readFileSync(path.join(RAIZ, 'test', 'entidades-26.3-medido.json'), 'utf8'))
const entidades = JSON.parse(fs.readFileSync(ARQUIVO, 'utf8'))

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

const mapa = mapaDe(entidades)
const porNome = new Map(entidades.filter((e) => e && e.name).map((e) => [e.name, e]))

test('o arquivo tem uma entrada por tipo de entidade registrado, sem buracos', () => {
  const ids = Object.keys(mapa).map(Number).sort((a, b) => a - b)
  assert.strictEqual(ids.length, ancoragem.total,
    'a tabela tem ' + ids.length + ' entradas e o registro da 26.3 tem ' + ancoragem.total)
  assert.strictEqual(ids[0], 0, 'a tabela não começa em 0')
  assert.strictEqual(ids[ids.length - 1], ancoragem.idMaximo,
    'o maior id é ' + ids[ids.length - 1] + ' e o medido é ' + ancoragem.idMaximo)
  for (let i = 0; i < ids.length; i++) {
    assert.strictEqual(ids[i], i,
      'buraco na sequência: a posição ' + i + ' tem o id ' + ids[i])
  }
})

test('nenhuma entrada vazia ou sem nome', () => {
  // O arquivo antigo tinha um `{}` solto no meio. Ele não quebra o require, e é
  // por isso que passou: só aparece quando alguém indexa a tabela pelo id.
  const vazias = entidades
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => !e || typeof e !== 'object' || !e.name)
    .map(({ e, i }) => 'posição ' + i + ': ' + JSON.stringify(e))
  assert.deepStrictEqual(vazias, [], 'entradas sem nome na tabela:\n  ' + vazias.join('\n  '))
})

test('o mapa id -> nome inteiro bate com o medido no client 26.3', () => {
  // Esta é a asserção que reprova a cópia deslocada: qualquer id que deslize
  // muda o sha e a mensagem diz qual nome ocupa o lugar errado.
  assert.strictEqual(shaDoMapa(mapa), ancoragem.shaMapa,
    'o mapa de entidades não bate com a medição do client 26.3 — ' +
    'se faltar uma entidade no meio, todos os ids seguintes deslizam')
})

test('as testemunhas nomeadas continuam nos ids medidos', () => {
  const erradas = []
  for (const [nome, id] of Object.entries(ancoragem.testemunhas)) {
    const real = porNome.get(nome)?.id
    if (real !== id) erradas.push(nome + ': arquivo=' + real + ' medido=' + id)
  }
  assert.deepStrictEqual(erradas, [], 'entidades fora do id medido:\n  ' + erradas.join('\n  '))
})

test('o jogador é 159 — o id que o servidor manda no spawn_entity', () => {
  // Repete o defeito real pelo nome, para não depender de o sha estar correto:
  // se a tabela inteira for regerada errada, esta asserção continua sendo a
  // afirmação do que quebrou o MiningPlugin.
  assert.strictEqual(porNome.get('player')?.id, 159,
    'player não está em 159: o spawn_entity do 26.3 manda 159 e o mineflayer ' +
    'vai tratar o jogador como entidade sem registro (entity = null)')
})

test('as quatro entidades que faltavam existem, com as medidas do bytecode', () => {
  const esperado = {
    cushion: { width: 1.0, height: 0.25, type: 'other' },
    poplar_boat: { width: 1.375, height: 0.5625, type: 'other' },
    poplar_chest_boat: { width: 1.375, height: 0.5625, type: 'other' },
    sulfur_cube: { width: 0.49, height: 0.49 }
  }
  for (const [nome, props] of Object.entries(esperado)) {
    const e = porNome.get(nome)
    assert.ok(e, 'a entidade "' + nome + '" não existe na tabela — é uma das que ' +
      'faltavam, e a falta dela desloca todo id maior')
    for (const [campo, valor] of Object.entries(props)) {
      assert.strictEqual(e[campo], valor, nome + '.' + campo + ' = ' + e[campo] + ', medido ' + valor)
    }
  }
})

test('internalId e id são o mesmo número em toda a tabela', () => {
  // O mineflayer indexa por `internalId` (`entityDataByInternalId`) e grava
  // `entity.entityType = id`. Dois campos para o mesmo número é onde a tabela
  // deslizada se esconde: o spawn acha a entrada por um e a nomeia pelo outro.
  const divergentes = entidades
    .filter((e) => e && e.name && e.internalId !== e.id)
    .map((e) => e.name + ': id=' + e.id + ' internalId=' + e.internalId)
  assert.deepStrictEqual(divergentes, [], 'id e internalId diferentes:\n  ' + divergentes.join('\n  '))
})

test('o jogador tem a hitbox do jogador', () => {
  const p = porNome.get('player')
  assert.strictEqual(p.width, 0.6, 'player.width = ' + p.width)
  assert.strictEqual(p.height, 1.8, 'player.height = ' + p.height)
  assert.strictEqual(p.type, 'player', 'player.type = ' + p.type)
})
