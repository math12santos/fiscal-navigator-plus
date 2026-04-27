import { describe, it, expect } from "vitest";
import { calcEmployeeNet } from "./payrollCalc";

describe("calcEmployeeNet", () => {
  it("CLT sem eventos: aplica INSS, IRRF e VT", () => {
    const r = calcEmployeeNet({
      salaryBase: 5000,
      contractType: "clt",
      vtBruto: 220, // 22 dias × R$10
    });
    expect(r.bruto).toBe(5000);
    expect(r.inssEmp).toBeGreaterThan(0);
    expect(r.irrf).toBeGreaterThan(0);
    expect(r.vtDesconto).toBeCloseTo(220, 1); // capa no VT bruto (220 < 6%×5000=300)
    expect(r.liquido).toBe(r.saldo);
    expect(r.adiantamento).toBe(0);
  });

  it("PJ: sem encargos do empregado", () => {
    const r = calcEmployeeNet({ salaryBase: 8000, contractType: "PJ" });
    expect(r.inssEmp).toBe(0);
    expect(r.irrf).toBe(0);
    expect(r.vtDesconto).toBe(0);
    expect(r.liquido).toBe(8000);
  });

  it("Proventos tributáveis aumentam base de INSS/IRRF", () => {
    const semEvento = calcEmployeeNet({ salaryBase: 5000, contractType: "clt" });
    const comHE = calcEmployeeNet({
      salaryBase: 5000,
      contractType: "clt",
      events: [{ signal: "provento", value: 1000, tributavel: true }],
    });
    expect(comHE.inssEmp).toBeGreaterThan(semEvento.inssEmp);
    expect(comHE.irrf).toBeGreaterThan(semEvento.irrf);
    expect(comHE.bruto).toBe(6000);
  });

  it("Provento isento aumenta líquido sem mexer em INSS/IRRF", () => {
    const base = calcEmployeeNet({ salaryBase: 5000, contractType: "clt" });
    const comAjuda = calcEmployeeNet({
      salaryBase: 5000,
      contractType: "clt",
      events: [{ signal: "provento", value: 500, tributavel: false }],
    });
    expect(comAjuda.inssEmp).toBeCloseTo(base.inssEmp, 2);
    expect(comAjuda.irrf).toBeCloseTo(base.irrf, 2);
    expect(comAjuda.liquido - base.liquido).toBeCloseTo(500, 1);
  });

  it("Adiantamento desativado: saldo = líquido total", () => {
    const r = calcEmployeeNet({
      salaryBase: 5000,
      contractType: "clt",
      advanceEnabled: false,
      advancePct: 40,
    });
    expect(r.adiantamento).toBe(0);
    expect(r.saldo).toBe(r.liquido);
  });

  it("Adiantamento 40%: divide líquido entre vale e saldo", () => {
    const r = calcEmployeeNet({
      salaryBase: 5000,
      contractType: "clt",
      advanceEnabled: true,
      advancePct: 40,
    });
    expect(r.adiantamento).toBeCloseTo(r.liquido * 0.4, 1);
    expect(r.saldo + r.adiantamento).toBeCloseTo(r.liquido, 1);
  });

  it("VT é capado em 6% do salário base", () => {
    const r = calcEmployeeNet({
      salaryBase: 2000,
      contractType: "clt",
      vtBruto: 500, // 6% de 2000 = 120 → desconto = 120, não 500
    });
    expect(r.vtDesconto).toBeCloseTo(120, 1);
  });
});
