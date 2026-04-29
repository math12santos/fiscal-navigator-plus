import { describe, expect, it } from "vitest";
import { addMonths, addYears } from "date-fns";
import { computeEmployeeVacationSummary } from "./vacationCalculations";

const ISO = (d: Date) => d.toISOString().slice(0, 10);

function makeRecord(paStart: Date, gozados = 0, vendidos = 0) {
  return {
    id: crypto.randomUUID(),
    employee_id: "emp-1",
    periodo_aquisitivo_inicio: ISO(paStart),
    periodo_aquisitivo_fim: ISO(addYears(paStart, 1)),
    data_inicio: null,
    data_fim: null,
    dias_gozados: gozados,
    dias_vendidos: vendidos,
  };
}

describe("computeEmployeeVacationSummary", () => {
  it("Sem PAs adquiridos quando admitido há menos de 12 meses", () => {
    const today = new Date(2026, 5, 1);
    const adm = addMonths(today, -6);
    const s = computeEmployeeVacationSummary(adm, [], today);
    expect(s.periodos.length).toBe(0);
    expect(s.proximasFeriasEm).toBeGreaterThan(0);
  });

  it("PA em dia: admitido há 14 meses, sem gozo", () => {
    const today = new Date(2026, 5, 1);
    const adm = addMonths(today, -14);
    const s = computeEmployeeVacationSummary(adm, [], today);
    expect(s.periodos.length).toBe(1);
    expect(s.periodos[0].diasSaldo).toBe(30);
    expect(s.periodos[0].status).toBe("em_dia");
  });

  it("Próximo vencimento: ≤ 3 meses do limite concessivo", () => {
    const today = new Date(2026, 5, 1);
    const adm = addMonths(today, -22); // PA1 fecha há 10m, limite há +2m
    const s = computeEmployeeVacationSummary(adm, [], today);
    expect(s.periodos[0].status).toBe("proximo_vencimento");
  });

  it("Vencido em dobro: passou do limite concessivo sem gozo", () => {
    const today = new Date(2026, 5, 1);
    const adm = addMonths(today, -28); // PA1 fechou há 16m; limite passou há 4m
    const s = computeEmployeeVacationSummary(adm, [], today);
    expect(s.periodos[0].status).toBe("vencido_em_dobro");
    expect(s.worstStatus).toBe("vencido_em_dobro");
  });

  it("2 PAs em aberto: sinaliza needsAttention", () => {
    const today = new Date(2026, 5, 1);
    const adm = addMonths(today, -25);
    const s = computeEmployeeVacationSummary(adm, [], today);
    expect(s.periodos.length).toBe(2);
    expect(s.periodosAbertos.length).toBe(2);
    expect(s.needsAttention).toBe(true);
  });

  it("Gozo total zera o saldo do PA", () => {
    const today = new Date(2026, 5, 1);
    const adm = addMonths(today, -14);
    const paStart = adm;
    const s = computeEmployeeVacationSummary(adm, [makeRecord(paStart, 30, 0)], today);
    expect(s.periodos[0].diasSaldo).toBe(0);
    expect(s.periodos[0].status).toBe("gozado");
  });

  it("Venda de 10 dias + gozo de 20 zera o saldo", () => {
    const today = new Date(2026, 5, 1);
    const adm = addMonths(today, -14);
    const s = computeEmployeeVacationSummary(adm, [makeRecord(adm, 20, 10)], today);
    expect(s.periodos[0].diasSaldo).toBe(0);
  });
});
