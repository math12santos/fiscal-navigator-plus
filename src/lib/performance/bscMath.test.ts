import { describe, it, expect } from "vitest";
import { computeIndicator, computeBscTotal } from "./bscMath";

describe("BSC math", () => {
  it("calcula % e status para indicador padrão", () => {
    const r = computeIndicator({ meta: 100, realizado: 80, peso: 1 });
    expect(r.percentual_atingimento).toBe(80);
    expect(r.status).toBe("parcial");
    expect(r.nota_ponderada).toBe(80);
  });

  it("inverte para 'quanto menor melhor'", () => {
    const r = computeIndicator({ meta: 30, realizado: 20, peso: 2, quanto_menor_melhor: true });
    expect(r.percentual_atingimento).toBe(150); // meta/realizado * 100
    expect(r.status).toBe("superado");
    expect(r.nota_ponderada).toBe(300);
  });

  it("retorna 0 quando meta=0", () => {
    const r = computeIndicator({ meta: 0, realizado: 50 });
    expect(r.percentual_atingimento).toBe(0);
    expect(r.status).toBe("abaixo");
  });

  it("calcula total ponderado do BSC", () => {
    const total = computeBscTotal([
      { meta: 100, realizado: 100, peso: 2 }, // 100% * 2 = 200
      { meta: 100, realizado: 50, peso: 1 },  //  50% * 1 = 50
    ]); // (250) / (3) = 83.33
    expect(total).toBeCloseTo(83.33, 2);
  });
});
