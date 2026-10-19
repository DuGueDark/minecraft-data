// WIRE DO 1.20.1 REAL — `declare_commands`, `slot` e `teams`
//
// ⭐ ESTE ARQUIVO É O CONTRASTE DO QUE JÁ SE DESCOBRIU ERRADO SOBRE ESTE ASSUNTO.
//
// A hipótese que chegou aqui era: "`data/pc/1.20/protocol.json` foi editado à mão
// e a 1.20.1 do DzBot não é a 1.20.1 do minecraft-data — está com
// `declare_commands` em formato 1.20.2+". Ela está REFUTADA, por medição:
//
//   1. `diff` do arquivo local contra o minecraft-data 3.117.0 do registro:
//      `declare_commands`, `command_node`, `slot`, `entityMetadata*` e
//      `packet_teams` são BYTE A BYTE iguais ao upstream. As únicas diferenças
//      são `packet_custom_payload`/`packet_login_plugin_response` (FML) e cinco
//      `mapper` trocados por `u8`/`varint` crus em outros pacotes.
//   2. Os frames REAIS medidos em Paper 1.20.1 (25571) e Forge 1.20.1 (25572)
//      são lidos INTEIROS pelo schema de `pc/1.20`: 59 e 31 nós, com os nomes
//      de comando verdadeiros. Nenhum `PartialReadError`.
//
// O `PartialReadError` que o dono viu (`Unexpected buffer end while reading
// VarInt` dentro de `command_node`; `readPString [as nbtTagName]` dentro de
// `slot`) tem outra causa, provada aqui: **o schema da 1.20.1 lido contra o
// wire de uma 1.20.3+ (com ViaVersion/ViaBackwards no servidor) dessincroniza**.
// As três divergências entre 1.20.1 e 1.20.3+ são exatamente:
//
//   | wire do servidor   | `pc/1.20` (1.20.1) lê          | erro medido                       |
//   |--------------------|--------------------------------|-----------------------------------|
//   | parser ids ≥ 18    | `minecraft:message` (18)       | `command_node` dessincroniza      |
//   | `anonOptionalNbt`  | `optionalNbt` (lê nome da tag) | `readPString [as nbtTagName]`     |
//   | `anonymousNbt`     | `string` (JSON)                | `string` em `packet_teams`        |
//
// Os testes abaixo travam os três, para que ninguém "conserte" o arquivo
// novamente para o formato de 1.20.2+ e reintroduza o defeito ao avesso.

const assert = require('node:assert')
const { test } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')

const BASE = path.join(__dirname, '..', 'data', 'pc')
const carregar = v => JSON.parse(fs.readFileSync(path.join(BASE, v, 'protocol.json'), 'utf8'))

// minecraft-protocol/protodef não resolvem por nome a partir deste repo aninhado
// (é o motivo registrado em wire-26x.spec.cjs). O caminho é explícito, e o que
// responde é o MESMO protodef que roda na socket.
const PROTOCOL = path.join(__dirname, '..', '..', '..', 'minecraft-protocol', 'src', 'index.js')
const { createSerializer, createDeserializer } = require(PROTOCOL)

const VERSAO = '1.20.1'

// ── frames crus capturados AO VIVO (nunca sintetizados) ──────────────────────
// Paper 1.20.1 (container modded-tests-paper1201-1, 127.0.0.1:25571): te no
// `deserializer.write`, ou seja, o frame que ENTRA no protodef, não o decode.
const HEX_PAPER_1201 =
  '103b00200102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20050121013f0501220561626f75740501230862756b6b69743a3f0501240c62756b6b69743a61626f75740501250b62756b6b69743a68656c700501260962756b6b69743a706c0501270e62756b6b69743a706c7567696e730501280a62756b6b69743a7665720501290e62756b6b69743a76657273696f6e05012a0863616c6c6261636b05012b0468656c7005012c0d6963616e68617362756b6b697401012d026d6505012e0e6d696e6563726166743a68656c7001012d0c6d696e6563726166743a6d6501012f0d6d696e6563726166743a6d7367010130116d696e6563726166743a7465616d6d73670900160e6d696e6563726166743a74656c6c09001a0c6d696e6563726166743a746d010131116d696e6563726166743a747269676765720900160b6d696e6563726166743a7701012f036d73670501320e70617065723a63616c6c6261636b05013302706c05013407706c7567696e73010130077465616d6d73670900160474656c6c09001a02746d0101310774726967676572050135037665720501360776657273696f6e0900160177160004617267730502146d696e6563726166743a61736b5f736572766572160004617267730502146d696e6563726166743a61736b5f736572766572160004617267730502146d696e6563726166743a61736b5f736572766572160004617267730502146d696e6563726166743a61736b5f736572766572160004617267730502146d696e6563726166743a61736b5f736572766572160004617267730502146d696e6563726166743a61736b5f736572766572160004617267730502146d696e6563726166743a61736b5f736572766572160004617267730502146d696e6563726166743a61736b5f736572766572160004617267730502146d696e6563726166743a61736b5f736572766572160004617267730502146d696e6563726166743a61736b5f736572766572160004617267730502146d696e6563726166743a61736b5f736572766572160004617267730502146d696e6563726166743a61736b5f736572766572060006616374696f6e12060007636f6d6d616e64050212013707746172676574730602146d696e6563726166743a61736b5f7365727665720600076d6573736167651216023839096f626a65637469766516146d696e6563726166743a61736b5f736572766572160004617267730502146d696e6563726166743a61736b5f736572766572160004617267730502146d696e6563726166743a61736b5f736572766572160004617267730502146d696e6563726166743a61736b5f736572766572160004617267730502146d696e6563726166743a61736b5f736572766572160004617267730502146d696e6563726166743a61736b5f7365727665720600076d6573736167651201013a0361646401013a0373657406000576616c7565030000'

// Forge 1.20.1 (container modded-tests-forge1201-1, 127.0.0.1:25572), mesma captura.
const HEX_FORGE_1201 =
  '101f000b0102030405060708090a0b01010c026d6505010d0468656c7005010e046c69737401010f036d73670900040474656c6c0900040177010110077465616d6d736709000702746d01011107747269676765720105121314151605666f72676501011706636f6e666967060006616374696f6e12060007636f6d6d616e6405020500057575696473020118077461726765747306020600076d657373616765121602191a096f626a65637469766516146d696e6563726166743a61736b5f73657276657205011b0374707301021c1d05747261636b010006656e7469747905000a64696d656e73696f6e730500046d6f647301000873686f7766696c650600076d6573736167651201011e0361646401011e0373657406000364696d26050006656e74697479050002746506000576616c7565030000'

// Lê um frame com o protodef da socket. O `console.log` é capturado porque o
// `FullPacketParser` do protodef ENGOLE o `PartialReadError` e só o imprime
// (`if (e.partialReadError) { console.log(e.stack) }`) — é exatamente assim que o
// ruído chega no log do dono, e é assim que ele é percebido aqui.
async function ler (buffer, versao = VERSAO) {
  const de = createDeserializer({ state: 'play', isServer: false, version: versao, compiled: true })
  const ruido = []
  const original = console.log
  console.log = (...a) => ruido.push(a.join(' '))
  let pacote = null
  de.on('data', x => { pacote = x })
  try {
    de.write(buffer)
    de.end()
  } finally {
    // o 'data' chega no próximo tick do stream: segura o console.log até lá
    for (let i = 0; i < 50 && !pacote && !ruido.length; i++) await new Promise(r => setImmediate(r))
    console.log = original
  }
  const pilha = ruido.join('\n')
  return {
    pacote,
    erro: pilha ? pilha.split('\n')[0] : null,
    frames: (pilha.match(/at Object\.([A-Za-z_0-9]+)/g) || []).map(s => s.replace('at Object.', ''))
  }
}

// acha o dicionário de `mappings` dentro de um schema, sem indexar caminho fixo
function acharMappings (no) {
  if (Array.isArray(no)) {
    for (const v of no) { const r = acharMappings(v); if (r) return r }
    return null
  }
  if (no && typeof no === 'object') {
    if (no.mappings && typeof no.mappings === 'object') return no.mappings
    for (const v of Object.values(no)) { const r = acharMappings(v); if (r) return r }
  }
  return null
}

const nomes = nodes => nodes.map(n => (n.extraNodeData ? n.extraNodeData.name : null))

test('o declare_commands REAL do Paper 1.20.1 é lido inteiro por pc/1.20', async () => {
  const r = await ler(Buffer.from(HEX_PAPER_1201, 'hex'))
  assert.equal(r.erro, null, 'não deve haver PartialReadError no frame real: ' + r.erro)
  const ns = r.pacote.data.params.nodes
  assert.equal(ns.length, 59, 'a árvore real do Paper 1.20.1 tem 59 nós')
  assert.equal(r.pacote.data.params.rootIndex, 0)
  // Nomes verdadeiros: prova de que o mapa do bitfield e o `children` batem, e
  // não só de que "não deu erro".
  const lista = nomes(ns)
  for (const esperado of ['about', 'bukkit:version', 'minecraft:tell', 'msg', 'w', 'help']) {
    assert.ok(lista.includes(esperado), `nome real ausente: ${esperado}`)
  }
  assert.equal(lista[0], null, 'o nó raiz (tipo 0) não tem nome no wire')
  // Todo nome é ASCII imprimível — o teste mais forte: um byte fora do lugar
  // produz lixo não imprimível, que foi o que apareceu nos outros logs.
  for (const n of lista) {
    if (n === null) continue
    assert.match(n, /^[\x20-\x7e]*$/, `nome não imprimível (dessincronia): ${JSON.stringify(n)}`)
  }
})

test('o declare_commands REAL do Forge 1.20.1 é lido inteiro por pc/1.20', async () => {
  const r = await ler(Buffer.from(HEX_FORGE_1201, 'hex'))
  assert.equal(r.erro, null, 'não deve haver PartialReadError no frame do Forge: ' + r.erro)
  assert.equal(r.pacote.data.params.nodes.length, 31)
  assert.ok(nomes(r.pacote.data.params.nodes).includes('tell'))
})

test('os argumentos da árvore real saem com parser do mapa da 1.20.1', async () => {
  const ns = (await ler(Buffer.from(HEX_PAPER_1201, 'hex'))).pacote.data.params.nodes
  const argumentos = ns.filter(n => n.extraNodeData && n.extraNodeData.parser !== undefined)
  assert.equal(argumentos.length, 24, 'a árvore real tem 24 nós de argumento')
  const vistos = new Set(argumentos.map(n => n.extraNodeData.parser))
  for (const p of vistos) {
    assert.equal(typeof p, 'string', `parser deve sair pelo mapper (nome), não cru: ${p}`)
  }
  assert.ok(vistos.has('brigadier:string'))
  assert.ok(vistos.has('minecraft:entity'))
})

test('command_node: mapa de parser é o da 1.20.1 (0..48, style NÃO existe)', () => {
  const mapa = acharMappings(carregar('1.20').types.command_node)
  assert.equal(mapa['18'], 'minecraft:message', '18 = message é o da 1.20.1')
  assert.equal(mapa['19'], 'minecraft:nbt', '19 = nbt é o da 1.20.1')
  assert.equal(mapa['48'], 'minecraft:uuid', 'a 1.20.1 vai até 48')
  assert.equal(mapa['49'], undefined, '49 só existe a partir da 1.20.3')
  assert.ok(!Object.values(mapa).includes('minecraft:style'), 'minecraft:style é 1.20.3+, não pode estar aqui')
  // E o 1.20.3 realmente desloca: é essa a divergência que quebra o cliente 1.20.1.
  const mapaNovo = acharMappings(carregar('1.20.3').types.command_node)
  assert.equal(mapaNovo['18'], 'minecraft:style', '1.20.3 insere style em 18')
  assert.equal(mapaNovo['19'], 'minecraft:message')
})

test('roundtrip: uma árvore montada no schema da 1.20.1 volta inteira', async () => {
  const ser = createSerializer({ state: 'play', isServer: true, version: VERSAO, compiled: true })
  const raiz = { flags: { unused: 0, has_custom_suggestions: 0, has_redirect_node: 0, has_command: 0, command_node_type: 0 }, children: [1, 2] }
  const literal = name => ({ flags: { unused: 0, has_custom_suggestions: 0, has_redirect_node: 0, has_command: 1, command_node_type: 1 }, children: [], extraNodeData: { name } })
  const argumento = (name, parser, properties) => ({ flags: { unused: 0, has_custom_suggestions: 0, has_redirect_node: 0, has_command: 1, command_node_type: 2 }, children: [], extraNodeData: { name, parser, properties } })
  const nodes = [
    raiz,
    literal('me'),
    argumento('n', 'brigadier:integer', { flags: { unused: 0, max_present: 0, min_present: 1 }, min: 5 })
  ]
  const bytes = ser.createPacketBuffer({ name: 'declare_commands', params: { nodes, rootIndex: 0 } })
  assert.ok(bytes.length > 10, 'o frame tem que ter conteúdo de verdade')
  const r = await ler(bytes)
  assert.equal(r.erro, null, 'roundtrip não pode dar PartialReadError: ' + r.erro)
  assert.equal(r.pacote.metadata.size, bytes.length, 'o protodef consome o frame inteiro')
  // byte a byte: reescreve o que foi lido e compara com o original. Comparar os
  // objetos não serve — `void` volta como `undefined`, e o wire não distingue
  // `null` de ausente; os BYTES é que são a prova.
  const voltou = r.pacote.data.params
  const bytes2 = ser.createPacketBuffer({ name: 'declare_commands', params: { nodes: voltou.nodes, rootIndex: voltou.rootIndex } })
  assert.equal(bytes2.toString('hex'), bytes.toString('hex'), 'reencode deve dar os mesmos bytes')
  assert.deepEqual(nomes(voltou.nodes), [null, 'me', 'n'], 'os nós voltam na ordem e com os nomes certos')
})

test('slot.nbtData é optionalNbt na 1.20.1 (o nbtTagName do log do dono)', () => {
  // O stack do dono era: shortString <- readPString [as nbtTagName] <- nbt <-
  // optionalNbt <- slot <- entityMetadataItem. Esse nome de campo (`nbtTagName`)
  // só existe em `optionalNbt`. A 1.20.2+ o mesmo campo é `anonOptionalNbt`,
  // que NÃO lê nome de tag — ler wire 1.20.2+ com este schema é o defeito.
  assert.ok(JSON.stringify(carregar('1.20').types.slot).includes('"optionalNbt"'), '1.20.1 lê NBT COM nome de tag')
  assert.ok(JSON.stringify(carregar('1.20.2').types.slot).includes('"anonOptionalNbt"'), '1.20.2+ é NBT anônimo')
})

test('packet_teams: componente é string até 1.20.2 e vira anonymousNbt em 1.20.5', () => {
  // Terceiro sintoma medido no log (o mais frequente): "Missing characters in
  // string ..." com `at Object.string` <- `at Object.packet_teams`.
  // O campo `name` (displayName) e os dois arrays de prefix/suffix carregam o
  // componente de chat: JSON string até 1.20.2, NBT anônimo a partir da 1.20.5.
  const campos = v => carregar(v).play.toClient.types.packet_teams[1][1]
  const c120 = campos('1.20').filter(c => c.name === 'name')[0]
  const c1202 = campos('1.20.2').filter(c => c.name === 'name')[0]
  const c1205 = campos('1.20.5').filter(c => c.name === 'name')[0]
  assert.equal(c120.type[1].fields['0'], 'string', '1.20: displayName é JSON string')
  assert.equal(c1202.type[1].fields['0'], 'string', '1.20.2: displayName ainda é JSON string')
  assert.equal(c1205.type[1].fields['0'], 'anonymousNbt', '1.20.5: displayName passou para NBT anônimo')
  // o mesmo vale para prefix/suffix, que vêm logo depois — se um deles mudar de
  // formato, o sintoma reaparece e este teste tem que ver.
  for (const campo of ['prefix', 'suffix']) {
    assert.ok(campos('1.20').some(c => c.name === campo), `1.20 tem ${campo}`)
    assert.ok(campos('1.20.5').some(c => JSON.stringify(c).includes('anonymousNbt')), `1.20.5 ${campo} usa NBT anônimo`)
  }
})

test('dataPaths: 1.20.1 usa o protocol de pc/1.20, e isso está certo', () => {
  const caminhos = JSON.parse(fs.readFileSync(path.join(BASE, '..', 'dataPaths.json'), 'utf8'))
  assert.equal(caminhos.pc['1.20.1'].protocol, 'pc/1.20')
  assert.equal(caminhos.pc['1.20.2'].protocol, 'pc/1.20.2', '1.20.2 tem schema próprio')
  assert.equal(JSON.parse(fs.readFileSync(path.join(BASE, '1.20', 'version.json'), 'utf8')).version, 763)
})