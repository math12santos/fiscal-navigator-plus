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

  it("advancePaymentDate: competência 10/2026 → dia 20/10/2026", () => {
    expect(iso(advancePaymentDate(new Date("2026-10-15T12:00:00")))).toBe("2026-10-20");
  });

  it("inssDueDate / fgtsDueDate: competência 10/2026 → dia 20 do mês seguinte", () => {
    const ref = new Date("2026-10-15T12:00:00");
    expect(iso(inssDueDate(ref))).toBe("2026-11-20");
    expect(iso(fgtsDueDate(ref))).toBe("2026-11-20");
  });

  it("benefitsPaymentDate: competência 11/2026 → último dia útil de 10/2026", () => {
    expect(iso(benefitsPaymentDate(new Date("2026-11-15T12:00:00")))).toBe("2026-10-30");
  });
});
