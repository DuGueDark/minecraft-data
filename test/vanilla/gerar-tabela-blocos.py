#!/usr/bin/env python3
"""Gera a tabela de blocos da 26.3 a partir do REGISTRO REAL do servidor vanilla.

O QUE ESTÁ DESLOCADO E POR QUE ESTE SCRIPT EXISTE
--------------------------------------------------
`data/pc/26.3/blocks.json` era uma cópia da 26.2: faltavam 118 blocos que a
26.3 registra (a familia do `poplar`, `sulfur`, `cinnabar`, as escadas/lajes de
lã e de concreto...). Como o id de um bloco é a POSIÇÃO dele no registro, e o
state id é a soma das contagens de estado dos blocos anteriores, a ausência
desloca TODO id a partir do primeiro buraco — e o bot passa a ler o nome (e a
caixa de colisão) do bloco errado para cada bloco do mundo.

A verdade não está em dedução: está no registro do proprio servidor. O
`DumpBlocos.java` roda o bootstrap do vanilla (o mesmo codigo que o jogo usa)
e escreve o registro inteiro: id, nome, estados, offset do estado padrao,
dureza, resistencia, luz e a CAIXA DE COLISAO de cada estado. Este script
transforma essa medicao nas duas tabelas do minecraft-data.

O QUE VEM DA MEDICAO E O QUE VEM DA TABELA ANTIGA
--------------------------------------------------
Da medicao (vanilla): id, name, defaultState, minStateId, maxStateId, states,
hardness, resistance, emitLight, filterLight, transparent, boundingBox, e as
caixas de colisao.

Da tabela antiga: displayName, stackSize, diggable, material, harvestTools,
drops — os campos cosmeticos, que o vanilla nao expoe de forma tao direta. Para
os 118 blocos NOVOS esses campos vem de um ANALOGO declarado na tabela
`ANALOGOS` (a familia do carvalho para a familia do poplar, e assim por
diante) — e isso esta escrito no arquivo, nao escondido.

USO
---
    java -cp <jar>:<libs> DumpBlocos <dump.json>
    python3 gerar-tabela-blocos.py <dump.json> [versao]
"""

import json
import os
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # .../minecraft-data


def float32_curto(valor):
    """O float do vanilla e float32; devolve o decimal mais curto que volta nele.

    O vanilla guarda 0.2f; lido como double da 0.20000000298023224. A tabela
    antiga escreve 0.2. Este caminho devolve o 0.2 — e o mesmo que o java faz
    quando voce escreve `strength(0.2f)`.
    """
    alvo = _fround(valor)
    for casas in range(1, 10):
        texto = "%.*g" % (casas, valor)
        if _fround(float(texto)) == alvo:
            return float(texto)
    return alvo


def _fround(x):
    import struct
    return struct.unpack("f", struct.pack("f", x))[0]


# O ANALOGO de cada bloco novo: de onde vem displayName/stackSize/diggable/
# material/harvestTools/drops. Declarado aqui para ser revisado, nao adivinhado.
ANALOGOS = {
    # familia do poplar (a do carvalho)
    "poplar_planks": "oak_planks",
    "poplar_sapling": "oak_sapling",
    "poplar_log": "oak_log",
    "stripped_poplar_log": "stripped_oak_log",
    "poplar_wood": "oak_wood",
    "stripped_poplar_wood": "stripped_oak_wood",
    "red_poplar_leaves": "oak_leaves",
    "orange_poplar_leaves": "oak_leaves",
    "yellow_poplar_leaves": "oak_leaves",
    "potted_poplar_sapling": "potted_oak_sapling",
    "poplar_shelf": "acacia_shelf",
    "poplar_sign": "oak_sign",
    "poplar_wall_sign": "oak_wall_sign",
    "poplar_hanging_sign": "oak_hanging_sign",
    "poplar_wall_hanging_sign": "oak_wall_hanging_sign",
    "poplar_pressure_plate": "oak_pressure_plate",
    "poplar_trapdoor": "oak_trapdoor",
    "poplar_button": "oak_button",
    "poplar_stairs": "oak_stairs",
    "poplar_slab": "oak_slab",
    "poplar_fence_gate": "oak_fence_gate",
    "poplar_fence": "oak_fence",
    "poplar_door": "oak_door",
    # cama de palha
    "straw_bed": "red_bed",
    # plantas
    "red_shrub": "short_dry_grass",
    "shelf_mushroom": "brown_mushroom",
    "sulfur_spike": "short_dry_grass",
    # familia do sulfur / cinnabar (a da pedra)
    "sulfur": "stone",
    "potent_sulfur": "stone",
    "polished_sulfur": "smooth_stone",
    "polished_sulfur_slab": "smooth_stone_slab",
    "polished_sulfur_stairs": "stone_stairs",
    "polished_sulfur_wall": "cobblestone_wall",
    "sulfur_slab": "stone_slab",
    "sulfur_stairs": "stone_stairs",
    "sulfur_wall": "cobblestone_wall",
    "sulfur_bricks": "stone_bricks",
    "sulfur_brick_slab": "stone_brick_slab",
    "sulfur_brick_stairs": "stone_brick_stairs",
    "sulfur_brick_wall": "stone_brick_wall",
    "chiseled_sulfur": "chiseled_stone_bricks",
    "cinnabar": "stone",
    "polished_cinnabar": "smooth_stone",
    "polished_cinnabar_slab": "smooth_stone_slab",
    "polished_cinnabar_stairs": "stone_stairs",
    "polished_cinnabar_wall": "cobblestone_wall",
    "cinnabar_slab": "stone_slab",
    "cinnabar_stairs": "stone_stairs",
    "cinnabar_wall": "cobblestone_wall",
    "cinnabar_bricks": "stone_bricks",
    "cinnabar_brick_slab": "stone_brick_slab",
    "cinnabar_brick_stairs": "stone_brick_stairs",
    "cinnabar_brick_wall": "stone_brick_wall",
    "chiseled_cinnabar": "chiseled_stone_bricks",
}


CORES = [
    "white", "orange", "magenta", "light_blue", "yellow", "lime", "pink", "gray",
    "light_gray", "cyan", "purple", "blue", "brown", "green", "red", "black",
]


def analog_de(nome):
    """O analogo de um bloco novo.

    Primeiro a tabela `ANALOGOS`; depois a regra das cores (a escada de la
    branca e a escada de la azul tem o mesmo material, a mesma pilha e o mesmo
    drop — so muda a cor, que a medicao do vanilla ja traz).
    """
    if nome in ANALOGOS:
        return ANALOGOS[nome]
    for cor in CORES:
        if not nome.startswith(cor + "_"):
            continue
        resto = nome[len(cor) + 1:]
        if resto in ("wool_stairs", "wool_slab"):
            return "white_wool"
        if resto in ("concrete_stairs", "concrete_slab"):
            return "white_concrete"
    return None


def titulo(nome):
    """'poplar_wall_sign' -> 'Poplar Wall Sign' (o padrao do displayName antigo)."""
    return " ".join(parte.capitalize() for parte in nome.split("_"))


def main():
    if len(sys.argv) < 2:
        print("uso: python3 gerar-tabela-blocos.py <dump.json> [versao]", file=sys.stderr)
        return 2
    dump = json.load(open(sys.argv[1], encoding="utf-8"))
    versao = sys.argv[2] if len(sys.argv) > 2 else "26.3"

    pasta = os.path.join(RAIZ, "data", "pc", versao)
    caminho_blocos = os.path.join(pasta, "blocks.json")
    caminho_formas = os.path.join(pasta, "blockCollisionShapes.json")

    antigos = json.load(open(caminho_blocos, encoding="utf-8"))
    antigos_por_nome = {b["name"]: b for b in antigos if isinstance(b, dict) and b.get("name")}
    formas_antigas = json.load(open(caminho_formas, encoding="utf-8"))
    itens = json.load(open(os.path.join(pasta, "items.json"), encoding="utf-8"))
    id_do_item = {i["name"]: i["id"] for i in itens if isinstance(i, dict) and i.get("name")}

    # ── as formas: preserva os ids que ja existem e acrescenta os novos ──────
    formas = dict(formas_antigas["shapes"])  # id (string) -> lista de AABBs
    formas_antigas_por_bloco = formas_antigas["blocks"]  # nome -> id | [ids]
    id_para_forma = {}
    for chave, caixas in formas.items():
        # PRIMEIRO vence: a tabela antiga tem varias ids com o MESMO conteudo
        # (o cubo cheio aparece em dezenas de ids). Reusar a menor mantem os
        # numeros de antes e deixa o diff legivel.
        id_para_forma.setdefault(_chave_caixas(caixas), int(chave))
    proximo_id = max(int(k) for k in formas) + 1 if formas else 0

    def id_da_forma(caixas):
        nonlocal proximo_id
        chave = _chave_caixas(caixas)
        if chave in id_para_forma:
            return id_para_forma[chave]
        novo = proximo_id
        proximo_id += 1
        formas[str(novo)] = caixas
        id_para_forma[chave] = novo
        return novo

    def ids_do_antigo(nome, caixas):
        """Os ids de forma que o bloco JA tinha, se o conteudo bateu.

        A tabela antiga tem ids redundantes (o cubo cheio tem ids 1, 10, 73,
        200...). Reusar o id que o bloco ja usava mantem o diff pequeno e
        evita um churn de numeros que nao quer dizer nada.
        """
        v = formas_antigas_por_bloco.get(nome)
        if v is None:
            return None
        if isinstance(v, list):
            if len(v) != len(caixas):
                return None
            for sid, c in zip(v, caixas):
                if _chave_caixas(formas[str(sid)]) != _chave_caixas(c):
                    return None
            return list(v)
        alvo = _chave_caixas(formas[str(v)])
        for c in caixas:
            if _chave_caixas(c) != alvo:
                return None
        return v

    # ── a tabela de blocos ────────────────────────────────────────────────────
    blocos = []
    mapa_formas = {}
    for medido in dump["blocos"]:
        nome = medido["nome"]
        antigo = antigos_por_nome.get(nome)
        analog = None if antigo else analog_de(nome)
        base = antigo or (antigos_por_nome.get(analog) if analog else None)

        # ids de forma por estado
        ids = ids_do_antigo(nome, medido["caixas"])
        if ids is None:
            ids_por_estado = [id_da_forma(c) for c in medido["caixas"]]
            ids = ids_por_estado[0] if len(set(ids_por_estado)) == 1 else ids_por_estado
        mapa_formas[nome] = ids

        if antigo is not None:
            # bloco que JA EXISTIA: os numeros cosmeticos ficam como estavam.
            # A medicao do vanilla concorda com eles em 1163 de 1168 (a excecao
            # sao 3 lajes, em que o vanilla devolve a resistencia do bloco base
            # e a tabela guarda a da familia) — e mexer neles aqui seria
            # trocar um valor bom por outro sem motivo.
            hardness = antigo.get("hardness", float32_curto(medido["dureza"]))
            resistance = antigo.get("resistance", float32_curto(medido["resistencia"]))
            display_name = antigo.get("displayName") or titulo(nome)
            stack_size = antigo.get("stackSize", 64)
            diggable = antigo.get("diggable", True)
            material = antigo.get("material", "default")
            transparent = antigo.get("transparent", not medido["opaco"])
            emit_light = antigo.get("emitLight", medido["emiteLuz"])
            filter_light = antigo.get("filterLight", medido["filtraLuz"])
            harvest_tools = antigo.get("harvestTools")
            drops = list(antigo.get("drops") or [])
            # o drop e o proprio item? entao usa o id do item DESTE bloco
            proprio = id_do_item.get(nome)
            drop_do_analogo = id_do_item.get(antigo["name"])
            if proprio is not None and drops == [drop_do_analogo]:
                drops = [proprio]
        else:
            # bloco NOVO: numeros vindos da medicao, cosmeticos do analogo.
            hardness = float32_curto(medido["dureza"])
            resistance = float32_curto(medido["resistencia"])
            display_name = titulo(nome)
            stack_size = base.get("stackSize", 64) if base else 64
            diggable = base.get("diggable", True) if base else True
            material = base.get("material", "default") if base else "default"
            transparent = not medido["opaco"]
            emit_light = medido["emiteLuz"]
            filter_light = medido["filtraLuz"]
            harvest_tools = base.get("harvestTools") if base else None
            drops = []
            proprio = id_do_item.get(nome)
            if proprio is not None:
                drops = [proprio]

        estado = {
            "id": medido["id"],
            "name": nome,
            "displayName": display_name,
            "hardness": hardness,
            "resistance": resistance,
            "stackSize": stack_size,
            "diggable": diggable,
            "material": material,
            "transparent": transparent,
            "emitLight": emit_light,
            "filterLight": filter_light,
            "defaultState": medido["defaultState"],
            "minStateId": medido["minStateId"],
            "maxStateId": medido["maxStateId"],
            "states": _estados(medido["propriedades"]),
        }
        if harvest_tools:
            estado["harvestTools"] = harvest_tools
        estado["drops"] = drops
        estado["boundingBox"] = "empty" if len(medido["caixas"][medido["defaultState"] - medido["minStateId"]]) == 0 else "block"
        blocos.append(estado)

    with open(caminho_blocos, "w", encoding="utf-8") as f:
        json.dump(blocos, f, indent=2, ensure_ascii=False)
        f.write("\n")
    with open(caminho_formas, "w", encoding="utf-8") as f:
        json.dump({"blocks": mapa_formas, "shapes": formas}, f, indent=2, ensure_ascii=False)
        f.write("\n")

    novos = [b["name"] for b in blocos if b["name"] not in antigos_por_nome]
    print("blocos: %d (antes %d, novos %d)" % (len(blocos), len(antigos_por_nome), len(novos)))
    print("formas: %d (antes %d)" % (len(formas), len(formas_antigas["shapes"])))
    print("sem analogo declarado: %s" % (sorted(set(novos) - {n for n in novos if analog_de(n)}) or "nenhum"))
    return 0


def _chave_caixas(caixas):
    """A chave de comparacao de uma forma: o CONJUNTO de caixas, sem ordem.

    A ordem das caixas dentro da forma nao muda nada na fisica (o prismarine
    percorre todas), e o vanilla entrega a ordem do `VoxelShape.toAabbs()`,
    que pode diferir da que a tabela antiga gravou. Comparar pelo conjunto
    faz o gerador REUSAR o id de forma que ja existe em vez de criar um
    equivalente com outro numero.
    """
    return json.dumps(sorted([[round(float(c), 6) for c in caixa] for caixa in caixas]))


def _estados(propriedades):
    """A mesma forma da tabela antiga: enum com 'values', bool sem 'values'."""
    saida = []
    for p in propriedades:
        estado = {"name": p["nome"], "type": p["tipo"], "num_values": p["numValores"]}
        if p["tipo"] != "bool":
            estado["values"] = [str(v).lower() for v in p["valores"]]
        saida.append(estado)
    return saida


if __name__ == "__main__":
    sys.exit(main())
