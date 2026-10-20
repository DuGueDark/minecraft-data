import java.io.*;
import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.util.*;

/**
 * DUMP DO REGISTRO DE BLOCOS DA 26.3, DIRETO DO SERVIDOR VANILLA.
 *
 * Roda o bootstrap do vanilla (que registra Blocos, Itens, etc.) e escreve o
 * registro de blocos em JSON: id -> nome, por bloco as propriedades de estado
 * (contagem de estados, offset do estado padrao), a CAIXA DE COLISAO de cada
 * estado (a mesma coisa que o minecraft-data guarda em blockCollisionShapes) e
 * os numeros de dureza/resistencia/luz.
 *
 *   java -cp <jar>:<libs> DumpBlocos <saida.json>
 */
public class DumpBlocos {
  static net.minecraft.world.level.block.state.BlockState AR;
  static net.minecraft.world.level.material.FluidState VAZIO;

  static final net.minecraft.world.level.BlockGetter NIVEL = new net.minecraft.world.level.BlockGetter() {
    public net.minecraft.world.level.block.entity.BlockEntity getBlockEntity(net.minecraft.core.BlockPos p) { return null; }
    public net.minecraft.world.level.block.state.BlockState getBlockState(net.minecraft.core.BlockPos p) { return AR; }
    public net.minecraft.world.level.material.FluidState getFluidState(net.minecraft.core.BlockPos p) { return VAZIO; }
    public int getMinY() { return -64; }
    public int getHeight() { return 384; }
    public int getMaxY() { return 320; }
  };

  public static void main(String[] args) throws Exception {
    File saida = new File(args.length > 0 ? args[0] : "blocos.json");
    net.minecraft.SharedConstants.tryDetectVersion();
    net.minecraft.server.Bootstrap.bootStrap();

    AR = net.minecraft.world.level.block.Blocks.AIR.defaultBlockState();
    VAZIO = net.minecraft.world.level.material.Fluids.EMPTY.defaultFluidState();

    net.minecraft.core.Registry<net.minecraft.world.level.block.Block> reg =
        net.minecraft.core.registries.BuiltInRegistries.BLOCK;

    TreeMap<Integer, String> ordem = new TreeMap<>();
    TreeMap<Integer, net.minecraft.world.level.block.Block> porId = new TreeMap<>();
    for (var e : reg.entrySet()) {
      net.minecraft.world.level.block.Block b = e.getValue();
      int id = reg.getId(b);
      ordem.put(id, reg.getKey(b).getPath());
      porId.put(id, b);
    }

    StringBuilder sb = new StringBuilder();
    sb.append("{\n  \"total\": ").append(ordem.size()).append(",\n");
    sb.append("  \"blocos\": [\n");
    int global = 0;
    boolean primeiro = true;
    for (var entry : ordem.entrySet()) {
      int id = entry.getKey();
      String nome = entry.getValue();
      net.minecraft.world.level.block.Block b = porId.get(id);
      var def = b.getStateDefinition();
      List<net.minecraft.world.level.block.state.BlockState> possiveis = def.getPossibleStates();
      int padrao = possiveis.indexOf(b.defaultBlockState());
      var estadoPadrao = possiveis.get(padrao);

      if (!primeiro) sb.append(",\n");
      primeiro = false;
      sb.append("    {\"id\": ").append(id)
        .append(", \"nome\": \"").append(nome).append("\"")
        .append(", \"minStateId\": ").append(global)
        .append(", \"maxStateId\": ").append(global + possiveis.size() - 1)
        .append(", \"defaultState\": ").append(global + padrao)
        .append(", \"numEstados\": ").append(possiveis.size())
        .append(", \"dureza\": ").append(n(b.defaultDestroyTime()))
        .append(", \"resistencia\": ").append(n(b.getExplosionResistance()))
        .append(", \"emiteLuz\": ").append(estadoPadrao.getLightEmission())
        .append(", \"filtraLuz\": ").append(estadoPadrao.getLightDampening())
        .append(", \"opaco\": ").append(estadoPadrao.canOcclude())
        .append(", \"solido\": ").append(estadoPadrao.isSolid())
        .append(", \"propriedades\": [");
      boolean primeiroProp = true;
      for (var p : def.getProperties()) {
        if (!primeiroProp) sb.append(", ");
        primeiroProp = false;
        List<?> valores = p.getPossibleValues();
        sb.append("{\"nome\": \"").append(p.getName()).append("\"")
          .append(", \"tipo\": \"").append(tipoDaPropriedade(p)).append("\"")
          .append(", \"numValores\": ").append(valores.size())
          .append(", \"valores\": [");
        boolean pv = true;
        for (var v : valores) {
          if (!pv) sb.append(", ");
          pv = false;
          sb.append("\"").append(String.valueOf(v)).append("\"");
        }
        sb.append("]}");
      }
      sb.append("], \"caixas\": [");
      boolean primeiraCaixa = true;
      for (var estado : possiveis) {
        if (!primeiraCaixa) sb.append(", ");
        primeiraCaixa = false;
        sb.append("[");
        List<net.minecraft.world.phys.AABB> caixas;
        try {
          caixas = estado.getCollisionShape(NIVEL, net.minecraft.core.BlockPos.ZERO).toAabbs();
        } catch (Throwable t) {
          caixas = Collections.emptyList();
        }
        boolean pc = true;
        for (var a : caixas) {
          if (!pc) sb.append(", ");
          pc = false;
          sb.append("[").append(n(a.minX)).append(",").append(n(a.minY)).append(",").append(n(a.minZ))
            .append(",").append(n(a.maxX)).append(",").append(n(a.maxY)).append(",").append(n(a.maxZ)).append("]");
        }
        sb.append("]");
      }
      sb.append("]}");
      global += possiveis.size();
    }
    sb.append("\n  ],\n  \"totalEstados\": ").append(global).append("\n}\n");

    try (Writer w = new OutputStreamWriter(new FileOutputStream(saida), StandardCharsets.UTF_8)) {
      w.write(sb.toString());
    }
    System.out.println("blocos=" + ordem.size() + " estados=" + global + " -> " + saida);
  }

  static String n(double d) {
    if (Double.isNaN(d)) return "null";
    if (d == Math.rint(d)) return String.valueOf((long) d);
    return String.valueOf(d);
  }

  static String tipoDaPropriedade(Object p) {
    String n = p.getClass().getName();
    if (n.contains("BooleanProperty")) return "bool";
    if (n.contains("IntegerProperty")) return "int";
    return "enum";
  }
}
