// O ROUNDTRIP PELO SERIALIZER DO MINECRAFT-PROTOCOL (o mesmo da socket)
//
// ⚠️ ESTE ARQUIVO NÃO FAZ ROUNDTRIP, E O MOTIVO ESTÁ AQUI.
//
// A primeira versão tentou `createSerializer`/`createDeserializer` do protodef
// (não existem na 1.19, que exporta ProtoDef/Serializer/Parser), depois o
// `createPacketBuffer` do minecraft-protocol (caminho não resolvível a partir
// deste repo aninhado). Duas tentativas de最好 caminho, zero roundtrip.
//
// O que ficou são as asserções sobre o SCHEMA, que é onde o defeito está: os
// campos declarados e o tipo declarado. Um roundtrip provaria que o protodef
// consegue ler o schema — e o protodef é genérico, ele lê o que for declarado.
//
// ⚠️ O QUE ISSO DEIXA DE PROVAR: que o WIRE do 26.2 real é o do 26.3. Isso
// exigiria o JAR do 26.2, que não existe no ambiente (o único servidor é 26.3,
// e um cliente 26.2 é rejeitado por ele). O raciocínio que sustenta a correção
// está em cada asserção e é de duas naturezas: a `teleport_confirm` de 1 campo
// é estruturalmente impossível numa versão moderna, e as máscaras vêm do mesmo
// snapshot do upstream que errou a 26.3 (a 26.1 e a 26.2 têm `map_chunk` byte a
// byte idêntico, sha 2481b73d30f5).

const assert = require('node:assert')
const { test } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')

const BASE = path.join(__dirname, '..', 'data', 'pc')
const carregar = (v) => JSON.parse(fs.readFileSync(path.join(BASE, v, 'protocol.json'), 'utf8'))

const CAMPOS_LUZ = ['skyLightMask', 'blockLightMask', 'emptySkyLightMask', 'emptyBlockLightMask']

function campos (d, direcao, nome) {
  const info = d.play[direcao].types[nome]
  assert.ok(info, `${nome} não existe no schema`)
  return info[1].filter((c) => c && typeof c === 'object' && c.name)
}

test('`teleport_confirm` da 26.2 tem os 6 campos do vanilla', () => {
  const c = campos(carregar('26.2'), 'toServer', 'packet_teleport_confirm')
  assert.deepStrictEqual(
    c.map((x) => x.name),
    ['teleportId', 'x', 'y', 'z', 'yRot', 'xRot'],
    'a 26.2 ainda manda 1 campo: nenhum Minecraft moderno aceita isso (a forma de 1 campo é de 1.8)'
  )
  const porNome = Object.fromEntries(c.map((x) => [x.name, x.type]))
  for (const n of ['x', 'y', 'z']) assert.strictEqual(porNome[n], 'f64', `${n} tem que ser f64`)
  for (const n of ['yRot', 'xRot']) assert.strictEqual(porNome[n], 'f32', `${n} tem que ser f32`)
})

test('as máscaras de luz da 26.2 são ByteArray (BitSet), e não array de i64', () => {
  const d = carregar('26.2')
  for (const pkt of ['packet_map_chunk', 'packet_update_light']) {
    for (const c of campos(d, 'toClient', pkt)) {
      if (!CAMPOS_LUZ.includes(c.name)) continue
      assert.strictEqual(
        c.type,
        'ByteArray',
        `${pkt}/${c.name} ainda é ${JSON.stringify(c.type)}: o wire do vanilla é ` +
          'varint de comprimento + bytes (BIT_SET), e ler como array de i64 desalinha o pacote'
      )
    }
  }
})

test('a 26.2 e a 26.3 concordam no wire destes dois pacotes', () => {
  const a = carregar('26.2')
  const b = carregar('26.3')
  const tcA = campos(a, 'toServer', 'packet_teleport_confirm').map((c) => c.name + ':' + c.type)
  const tcB = campos(b, 'toServer', 'packet_teleport_confirm').map((c) => c.name + ':' + c.type)
  assert.deepStrictEqual(tcA, tcB, 'o teleport_confirm da 26.2 diverge do da 26.3 no wire')
  for (const pkt of ['packet_map_chunk', 'packet_update_light']) {
    for (const c of campos(a, 'toClient', pkt)) {
      if (!CAMPOS_LUZ.includes(c.name)) continue
      const igual = campos(b, 'toClient', pkt).find((x) => x.name === c.name)
      assert.strictEqual(
        c.type,
        igual.type,
        `${pkt}/${c.name}: a 26.2 diz ${JSON.stringify(c.type)} e a 26.3 diz ${JSON.stringify(igual.type)}`
      )
    }
  }
})

test('o que NÃO foi tocado: `sync_entity_position` é diferença REAL de versão', () => {
  const a = campos(carregar('26.2'), 'toClient', 'packet_sync_entity_position').map((c) => c.name)
  assert.ok(
    a.includes('x') && a.includes('dx'),
    `o sync_entity_position da 26.2 mudou para ${a.join(', ')} — a 26.3 usa positionPath, ` +
      'que é diferença real de versão, não bug de upstream'
  )
})

test('o mineflayer tolera as DUAS formas da máscara (o schema era o problema)', () => {
  const fonte = fs.readFileSync(
    path.join(__dirname, '..', '..', '..', 'mineflayer', 'lib', 'plugins', 'blocks.js'),
    'utf8'
  )
  assert.match(
    fonte,
    /if \(!Buffer\.isBuffer\(mask\) && !\(mask instanceof Uint8Array\)\) return mask/,
    'o normalizeLightMask deixou de ser pass-through: uma versão que mande o array ' +
      'antigo passaria a ser convertida, e a que manda ByteArray seria tratada como array'
  )
})
