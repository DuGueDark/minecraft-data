# O REGISTRO DE BLOCOS DA 26.3, MEDIDO NO SERVIDOR

Este diretório é o **instrumento** que gerou `data/pc/26.3/blocks.json` e
`data/pc/26.3/blockCollisionShapes.json`.

## POR QUE PRECISA DISSO

Desde 1.20.5 o registro de blocos do Minecraft vai por **nome**: o número (o
id) é a **posição** na ordem de registro, e essa ordem não está em lugar
nenhum do JSON do servidor. A única fonte autoritativa é o próprio servidor
vanilla — o `BuiltInRegistries.BLOCK`, que o bootstrap do vanilla preenche.

A tabela que estava no repositório era uma **cópia da 26.2**: faltavam 118
blocos que a 26.3 registra. Como o id é a posição e o *blockstate id* é a soma
das contagens de estado dos blocos anteriores, a ausência desloca todo id a
partir do primeiro buraco — e o bot passa a ler o nome (e a caixa de colisão)
do bloco **errado** para cada bloco do mundo.

## OS DOIS PASSOS

**1. Medir o registro no servidor vanilla** (`DumpBlocos.java`):

```sh
# o jar do servidor 26.3 do dono e as bibliotecas do Paper
JAR=~/Downloads/java-server-26.3/versions/26.3/server-26.3.jar
LIBS=$(find ~/Downloads/java-server-26.3/libraries -name '*.jar' | tr '\n' ':')

javac -cp "$JAR:$LIBS" -d /tmp DumpBlocos.java
java  -cp "/tmp:$JAR:$LIBS" DumpBlocos /tmp/blocos-vanilla-26.3.json
```

Sai um JSON com, por bloco: o `id` do registro, o nome, os estados (nome, tipo,
valores), o `minStateId`/`maxStateId`/`defaultState`, a dureza, a resistência,
a luz, e a **caixa de colisão de cada estado** (`getCollisionShape`).

**2. Transformar a medição nas tabelas do minecraft-data**
(`gerar-tabela-blocos.py`):

```sh
python3 test/vanilla/gerar-tabela-blocos.py /tmp/blocos-vanilla-26.3.json 26.3
```

O script:
- **preserva** os ids de forma e os campos cosméticos dos blocos que já
  existiam (o diff fica pequeno e revisável);
- **acrescenta** os 118 blocos novos, com os números vindos da medição e os
  campos cosméticos vindos de um **analogo declarado** na tabela `ANALOGOS`
  do próprio script (a família do carvalho para a do poplar, e assim por
  diante);
- reescreve `id`, `minStateId`, `maxStateId`, `defaultState` e `states` de
  **todos** os blocos, pela ordem do registro medido.

## A GUARDA

`test/blocos-26x.spec.cjs` + `test/blocos-26.3-medido.json` congelam a
medição: o sha do mapa `id -> nome`, do layout de estados e das caixas de
colisão, mais as testemunhas nomeadas. **Esta guarda depende de ancoragem
externa**: se a 26.3 mudar, ela envelhece e a re-extração do jar é o caminho —
ela não descobre sozinha que envelheceu.

```sh
node --test test/blocos-26x.spec.cjs
```
