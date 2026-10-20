// GUARDA DO MAPPER DE PARTÍCULAS DA 26.3
//
// ─────────────────────────────────────────────────────────────────────────────
// O QUE ESTÁ SENDO GUARDADO
//
// `data/pc/26.3/protocol.json` tem o mapa dos tipos de metadado de entidade
// (o índice que o servidor manda) e, dentro dele, o mapa das PARTÍCULAS.
//
// O mapper de partículas estava com **117** entradas e o servidor da 26.3
// registra **128**. Com o índice errado, o leitor do protocolo consumia menos
// bytes do que o pacote tinha — e o resto do pacote ficava no buffer, de modo
// que o pacote seguinte era lido a partir do meio.
//
// MEDIDO (no servidor 26.3 do dono, `127.0.0.1:25565`):
//   - antes: 93 `entity_metadata` por 8 s, TODOS com "Chunk size is 13 but
//     only 9 was read", e os 637 `map_chunk` que chegavam NÃO eram aplicados
//     (o `blockAt` devolvia null);
//   - depois: o mesmo pacote NÃO falha mais.
//
// A ORDEM é a ordem de REGISTRO do servidor (o id é a posição), e a verdade
// é o `<clinit>` de `net/minecraft.core.particles.ParticleTypes` no jar do
// servidor: 128 entradas, na ordem do registro.
//
// ⚠️ ESTA GUARDA DEPENDE DE ANCORAGEM EXTERNA: ela prova que o arquivo bate
// com a medição de um servidor 26.3, numa data. Se a 26.3 mudar, a guarda
// envelhece — ela não descobre sozinha, e não finge que descobre.

const assert = require('node:assert')
const { test } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

const RAIZ = path.join(__dirname, '..')
const ARQUIVO = path.join(RAIZ, 'data', 'pc', '26.3', 'protocol.json')
const ANCORAGEM = path.join(__dirname, 'particulas-26.3-medido.json')

const protocolo = JSON.parse(fs.readFileSync(ARQUIVO, 'utf8'))
const ancoragem = JSON.parse(fs.readFileSync(ANCORAGEM, 'utf8'))

/** O mapa id -> nome das partículas, como está no protocol.json. */
function mapaDeParticulas () {
  const mappings = protocolo.types.Particle[1][0].type[1].mappings
  const mapa = {}
  for (const [id, nome] of Object.entries(mappings)) mapa[id] = nome
  return mapa
}

/** A forma canônica (a mesma da âncora): "id=nome" em ordem de id. */
function canonico (mapa) {
  const ids = Object.keys(mapa).map(Number).sort((a, b) => a - b)
  return ids.map((id) => `${id}=${mapa[id]}`).join('\n')
}

test('o mapper de partículas tem 128 entradas (as do servidor 26.3)', () => {
  const mapa = mapaDeParticulas()
  assert.strictEqual(Object.keys(mapa).length, 128)
})

test('o mapa bate com a medição congelada (sha)', () => {
  const mapa = mapaDeParticulas()
  const sha = crypto.createHash('sha256').update(canonico(mapa)).digest('hex')
  assert.strictEqual(sha, ancoragem.sha, 'o mapa de partículas mudou em relação à medição')
})

test('as partículas que faltavam existem, com o índice medido', () => {
  const mapa = mapaDeParticulas()
  for (const [id, nome] of Object.entries(ancoragem.testemunhas)) {
    assert.strictEqual(mapa[id], nome, `a partícula ${nome} não está no índice ${id}`)
  }
})

test('o switch do payload tem as chaves das partículas com dados', () => {
  const campos = protocolo.types.Particle[1][1].type[1].fields
  // Medido no jar: GeyserParticleOptions = INT (waterBlocks) e
  // GeyserBaseParticleOptions = INT + FLOAT (waterBlocks, burstImpulseBase).
  assert.strictEqual(campos.geyser, 'i32')
  assert.ok(campos.geyser_base, 'geyser_base sem payload')
  assert.ok(campos.geyser_poof, 'geyser_poof sem payload')
  assert.strictEqual(campos.geyser_plume, 'i32')
})
