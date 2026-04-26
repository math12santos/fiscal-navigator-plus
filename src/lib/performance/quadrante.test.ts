import { describe, it, expect } from "vitest";
import { levelFromScore, quadrantFrom } from "./quadrante";

describe("9Box quadrante", () => {
  it("classifica nivel a partir da nota", () => {
    expect(levelFromScore(1)).toBe("baixo");
    expect(levelFromScore(2.9)).toBe("baixo");
    expect(levelFromScore(3)).toBe("medio");
    expect(levelFromScore(3.9)).toBe("medio");
    expect(levelFromScore(4)).toBe("alto");
    expect(levelFromScore(5)).toBe("alto");
  });

  it("calcula quadrantes nos extremos e centro", () => {
    // baixo+baixo -> 1 (risco crítico)
    expect(quadrantFrom(1, 1)).toBe(1);
    // alto desempenho + baixo potencial -> 3 (especialista)
    expect(quadrantFrom(5, 1)).toBe(3);
    // baixo desempenho + alto potencial -> 7 (aposta)
    expect(quadrantFrom(1, 5)).toBe(7);
    // alto+alto -> 9 (talento estratégico)
    expect(quadrantFrom(5, 5)).toBe(9);
    // medio+medio -> 5 (consistente)
    expect(quadrantFrom(3, 3)).toBe(5);
  });
});
