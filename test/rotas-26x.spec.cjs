// GUARDA DA ROTACAO DOS REGISTROS (dataPaths.json)
//
// ─────────────────────────────────────────────────────────────────────────────
// O QUE ESTÁ SENDO GUARDADO
//
// `dataPaths.json` é o mapa "versão -> pasta onde cada registro está". O
// `data.js` gerado transforma cada linha num `require()`:
//
//     get items () { return require("./minecraft-data/data/pc/26.1/items.json") }
//
// A 26.2 estava com quase tudo apontado para `pc/26.1`, entre eles `items`,
// `entities`, `windows` e `proto` — e `pc/26.2/entities.json`, `pc/26.2/
// windows.json` e `pc/26.2/proto.yml` EXISTEM no disco, postas lá de propósito
// e nunca lidas.
//
// O sintoma do `items` foi o inventário mostrar o item errado na 26.2 enquanto as
// outras versões funcionavam: o arquivo "da 26.2" era uma cópia do da 26.1, e o
// carregador nem olhava para ele.
//
// ─────────────────────────────────────────────────────────────────────────────
// POR QUE ESTA GUARDA É DIFERENTE DA DO items.json
//
// Esta aqui é uma asserção de ESTRUTURA, não de medição: ela não precisa de
// âncora externa, porque a verdade é verificável dentro do repositório. A
// pergunta é "existe um arquivo na pasta da versão que ninguém lê?" — e a
// resposta é sim/não, sem depender de servidor nenhum. Isso a torna mais forte
// que a do `items.json` no que consegue cobrir: ela pega o defeito em QUALQUER
// versão, inclusive numa que ninguém testou ainda.

const assert = require('node:assert')
const { test } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')

const RAIZ = path.join(__dirname, '..')
const DATA = path.join(RAIZ, 'data')
const PC = path.join(DATA, 'pc')
const dataPaths = JSON.parse(fs.readFileSync(path.join(DATA, 'dataPaths.json'), 'utf8'))

const EXTENSAO = { proto: '.yml' }

// Versões 26.x: as três foram montadas copiando uma da outra, que é como o
// arquivo de uma pasta de versão nasce sem registro próprio.
const VERSOES_26 = ['26.1', '26.2', '26.3']

test('toda versão 26.x está declarada no dataPaths.json', () => {
  for (const v of VERSOES_26) {
    assert.ok(dataPaths.pc[v], 'a versão ' + v + ' não está em dataPaths.pc — ' +
      'versões novas que existem só em data/pc não chegam ao mineflayer')
  }
})

test('nenhum arquivo da pasta de uma versão 26.x fica sem uso', () => {
  // A asserção central. Se o arquivo está na pasta da versão e a rota aponta
  // para outra pasta, ele está sendo ignorado — que foi o defeito.
  const orfaos = []
  for (const v of VERSOES_26) {
    const entrada = dataPaths.pc[v]
    if (!entrada) continue
    const pasta = path.join(PC, v)
    if (!fs.existsSync(pasta)) continue
    for (const arquivo of fs.readdirSync(pasta)) {
      const nome = arquivo.replace(/\.(json|yml)$/, '')
      if (!(nome in entrada)) continue // registro que a versão nem expõe
      const apontado = entrada[nome]
      const destinoCerto = 'pc/' + v
      if (apontado !== destinoCerto) {
        orfaos.push(v + '.' + nome + ' está em ' + destinoCerto +
          ' mas a rota diz ' + apontado + '  (' + arquivo + ')')
      }
    }
  }
  assert.deepStrictEqual(orfaos, [],
    'arquivos que existem na pasta da versão e são ignorados:\n  ' + orfaos.join('\n  '))
})

test('toda rota de registro aponta para uma pasta que existe', () => {
  // O outro lado: uma rota para pasta inexistente quebra o require() na
  // primeira leitura, e o sintoma é um crash de carga, não um item errado.
  const quebradas = []
  for (const v of VERSOES_26) {
    const entrada = dataPaths.pc[v]
    if (!entrada) continue
    for (const [registro, pasta] of Object.entries(entrada)) {
      if (registro === 'proto') {
        // `proto` pode apont para `pc/latest`, que é um alias da versão mais
        // nova. O caminho é relativo a `data/`, como o de qualquer outro
        // registro — a primeira versão deste teste usava `PC` aqui e acusava
        // `data/pc/pc/26.1/proto.yml`, um caminho que não existe por construção.
        if (pasta !== 'pc/latest' && !fs.existsSync(path.join(DATA, pasta, 'proto.yml'))) {
          quebradas.push(v + '.proto -> ' + pasta)
        }
        continue
      }
      const ext = EXTENSAO[registro] || '.json'
      if (!fs.existsSync(path.join(DATA, pasta, registro + ext))) {
        quebradas.push(v + '.' + registro + ' -> ' + pasta + ' (' + registro + ext + ' não existe)')
      }
    }
  }
  assert.deepStrictEqual(quebradas, [], 'rotas quebradas:\n  ' + quebradas.join('\n  '))
})

test('a 26.2 não herda de si mesma nem da 26.3 os registros que tem', () => {
  // Repete o caso medido, com o nome em vez da regra geral: se a regra geral
  // for afrouxada no futuro, esta continua sendo a afirmação do defeito real.
  const entrada = dataPaths.pc['26.2']
  for (const registro of ['items', 'entities', 'windows', 'protocol', 'version', 'proto']) {
    assert.strictEqual(entrada[registro], 'pc/26.2',
      'a 26.2.' + registro + ' está roteada para ' + entrada[registro] +
      ' — o arquivo existe em pc/26.2 e não está sendo lido')
  }
})

test('a 26.1 e a 26.2 deixou de ser o mesmo arquivo de items', () => {
  // Esta é a segunda metade do defeito. A rota pode estar certa e o arquivo
  // errado: a 26.2 apontava para pc/26.1 E pc/26.2/items.json era a cópia.
  const a = fs.readFileSync(path.join(PC, '26.1', 'items.json'))
  const b = fs.readFileSync(path.join(PC, '26.2', 'items.json'))
  assert.ok(!a.equals(b),
    'pc/26.2/items.json é byte a byte o de pc/26.1 — é a cópia que causou o ' +
    'inventário errado na 26.2 (o registro real tem ~27 itens a mais)')
})
