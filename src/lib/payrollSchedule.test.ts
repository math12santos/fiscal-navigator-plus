import { describe, it, expect } from "vitest";
import {
  nthBusinessDay,
  lastBusinessDayOf,
  calendarDayOf,
  salaryPaymentDate,
  advancePaymentDate,
  inssDueDate,
  fgtsDueDate,
  benefitsPaymentDate,
  describeSalaryPaymentDay,
  formatCompetencyLabel,
  formatCompetencyLong,
  nextNPaymentDates,
} from "./payrollSchedule";

const iso = (d: Date) => d.toISOString().slice(0, 10);

describe("payrollSchedule", () => {
  it("nthBusinessDay: 5º dia útil de novembro/2026", () => {
    // 1/11/2026 é domingo — 1º dia útil é segunda 2/11
    expect(iso(nthBusinessDay(new Date("2026-11-01T12:00:00"), 5))).toBe("2026-11-06");
  });

  it("lastBusinessDayOf: outubro/2026 termina sábado, último útil = sexta 30", () => {
    expect(iso(lastBusinessDayOf(new Date("2026-10-15T12:00:00")))).toBe("2026-10-30");
  });

  it("calendarDayOf: clamp para fevereiro", () => {
    expect(iso(calendarDayOf(new Date("2027-02-10T12:00:00"), 31))).toBe("2027-02-28");
  });

  it("salaryPaymentDate: competência 10/2026 → 5º dia útil de 11/2026", () => {
    expect(iso(salaryPaymentDate(new Date("2026-10-15T12:00:00")))).toBe("2026-11-06");
  });

  it("salaryPaymentDate (calendar_day): respeita o dia exato configurado", () => {
    expect(
      iso(salaryPaymentDate(new Date("2026-10-15T12:00:00"), {
        salary_payment_day: 10,
        salary_payment_basis: "calendar_day",
      })),
    ).toBe("2026-11-10");
  });

  it("advancePaymentDate: competência 10/2026 → dia 20/10/2026", () => {
    expect(iso(advancePaymentDate(new Date("2026-10-15T12:00:00")))).toBe("2026-10-20");
  });

  it("inssDueDate / fgtsDueDate: competência 10/2026 → dia 20 do mês seguinte", () => {
    const ref = new Date("2026-10-15T12:00:00");
    expect(iso(inssDueDate(ref))).toBe("2026-11-20");
    expect(iso(fgtsDueDate(ref))).toBe("2026-11-20");
  });

  // ============ Regra CLT/PAT — VT/VR/VA antecipados ============

  it("benefitsPaymentDate: competência 11/2026 → último dia útil de 10/2026", () => {
    expect(iso(benefitsPaymentDate(new Date("2026-11-15T12:00:00")))).toBe("2026-10-30");
  });

  it("benefitsPaymentDate: competência 05/2026 → 30/04/2026 (último dia útil de abril)", () => {
    expect(iso(benefitsPaymentDate(new Date("2026-05-15T12:00:00")))).toBe("2026-04-30");
  });

  it("benefitsPaymentDate: competência 04/2026 → 31/03/2026 (último dia útil de março)", () => {
    expect(iso(benefitsPaymentDate(new Date("2026-04-15T12:00:00")))).toBe("2026-03-31");
  });

  it("benefitsPaymentDate (dia 25 calendário): competência 05/2026 → 25/04/2026", () => {
    expect(
      iso(benefitsPaymentDate(new Date("2026-05-15T12:00:00"), { benefits_payment_day: 25 })),
    ).toBe("2026-04-25");
  });

  // ============ Helpers de exibição ============

  it("describeSalaryPaymentDay: 5 + business_day → '5º dia útil'", () => {
    expect(describeSalaryPaymentDay({ salary_payment_day: 5, salary_payment_basis: "business_day" }))
      .toBe("5º dia útil");
  });

  it("describeSalaryPaymentDay: 10 + calendar_day → 'Dia 10 (calendário)'", () => {
    expect(describeSalaryPaymentDay({ salary_payment_day: 10, salary_payment_basis: "calendar_day" }))
      .toBe("Dia 10 (calendário)");
  });

  it("formatCompetencyLabel / Long: 05/2026 e maio/2026", () => {
    const ref = new Date("2026-05-15T12:00:00");
    expect(formatCompetencyLabel(ref)).toBe("05/2026");
    expect(formatCompetencyLong(ref)).toBe("maio/2026");
  });

  it("nextNPaymentDates: gera 3 competências com salário e benefícios coerentes", () => {
    const rows = nextNPaymentDates(3, {
      salary_payment_day: 5,
      salary_payment_basis: "business_day",
      benefits_payment_day: -1,
    }, new Date("2026-04-15T12:00:00"));

    expect(rows).toHaveLength(3);
    expect(rows[0].competencyLabel).toBe("04/2026");
    // VR comp. 05/2026 (rows[1]) = último dia útil de 04/2026 = 30/04/2026
    expect(iso(rows[1].benefits)).toBe("2026-04-30");
  });
});
