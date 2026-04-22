import { describe, it, expect } from "vitest";
import { calculateTermination } from "./terminationCalculations";

/**
 * Invariantes críticos de regime — protegem contra regressões trabalhistas/fiscais
 * que poderiam expor a empresa a passivos indevidos ou cálculos ilegais.
 */
describe("calculateTermination — invariantes por regime", () => {
  const adm = new Date("2023-01-15");
  const term = new Date("2024-07-15"); // 18 meses de vínculo

  describe("PJ — relação cível, distrato comercial", () => {
    it.each(["distrato_aviso", "distrato_imediato", "fim_contrato"] as const)(
      "tipo %s: NUNCA gera FGTS, 13º, férias ou 1/3",
      (terminationType) => {
        const r = calculateTermination({
          salary: 10000,
          admissionDate: adm,
          terminationDate: term,
          contractType: "PJ",
          terminationType,
        });
        expect(r.contract_type).toBe("PJ");
        expect(r.multa_fgts).toBe(0);
        expect(r.decimo_terceiro_proporcional).toBe(0);
        expect(r.ferias_proporcionais).toBe(0);
        expect(r.terco_ferias).toBe(0);
      }
    );

    it("distrato_aviso: paga aviso contratual (1 mês cheio)", () => {
      const r = calculateTermination({
        salary: 10000,
        admissionDate: adm,
        terminationDate: term,
        contractType: "PJ",
        terminationType: "distrato_aviso",
      });
      expect(r.aviso_previo).toBe(10000);
    });

    it("distrato_imediato: zero aviso", () => {
      const r = calculateTermination({
        salary: 10000,
        admissionDate: adm,
        terminationDate: term,
        contractType: "PJ",
        terminationType: "distrato_imediato",
      });
      expect(r.aviso_previo).toBe(0);
    });

    it("FGTS pct configurado não afeta PJ (mesmo com 50%)", () => {
      const r = calculateTermination({
        salary: 10000,
        admissionDate: adm,
        terminationDate: term,
        contractType: "PJ",
        terminationType: "distrato_aviso",
        fgtsPct: 50,
      });
      expect(r.multa_fgts).toBe(0);
    });
  });

  describe("Estágio — Lei 11.788, sem encargos trabalhistas", () => {
    it.each(["sem_justa_causa", "pedido_demissao", "acordo"] as const)(
      "tipo %s (irrelevante para estagio): NUNCA gera FGTS, 13º, multa, aviso",
      (terminationType) => {
        const r = calculateTermination({
          salary: 1500,
          admissionDate: adm,
          terminationDate: term,
          contractType: "estagio",
          terminationType,
        });
        expect(r.contract_type).toBe("estagio");
        expect(r.multa_fgts).toBe(0);
        expect(r.decimo_terceiro_proporcional).toBe(0);
        expect(r.terco_ferias).toBe(0);
        expect(r.aviso_previo).toBe(0);
      }
    );

    it("paga recesso proporcional no slot de férias (semântica de banco)", () => {
      // 18 meses → 18 % 12 = 6 meses no período aquisitivo atual
      // recesso = (1500/12) * 6 = 750
      const r = calculateTermination({
        salary: 1500,
        admissionDate: adm,
        terminationDate: term,
        contractType: "estagio",
        terminationType: "pedido_demissao",
      });
      expect(r.ferias_proporcionais).toBe(750);
    });
  });

  describe("CLT — referência (deve gerar FGTS/13º/férias)", () => {
    it("sem_justa_causa: gera multa FGTS, 13º proporcional, férias + 1/3", () => {
      const r = calculateTermination({
        salary: 5000,
        admissionDate: adm,
        terminationDate: term,
        contractType: "CLT",
        terminationType: "sem_justa_causa",
      });
      expect(r.multa_fgts).toBeGreaterThan(0);
      expect(r.decimo_terceiro_proporcional).toBeGreaterThan(0);
      expect(r.ferias_proporcionais).toBeGreaterThan(0);
      expect(r.terco_ferias).toBeCloseTo(r.ferias_proporcionais / 3, 1);
      expect(r.aviso_previo).toBeGreaterThan(0);
    });

    it("com_justa_causa: zera férias, 13º e multa FGTS", () => {
      const r = calculateTermination({
        salary: 5000,
        admissionDate: adm,
        terminationDate: term,
        contractType: "CLT",
        terminationType: "com_justa_causa",
      });
      expect(r.multa_fgts).toBe(0);
      expect(r.decimo_terceiro_proporcional).toBe(0);
      expect(r.ferias_proporcionais).toBe(0);
      expect(r.aviso_previo).toBe(0);
    });

    it("acordo: multa FGTS é 20% do acumulado (metade do sem_justa_causa)", () => {
      const semJusta = calculateTermination({
        salary: 5000,
        admissionDate: adm,
        terminationDate: term,
        contractType: "CLT",
        terminationType: "sem_justa_causa",
      });
      const acordo = calculateTermination({
        salary: 5000,
        admissionDate: adm,
        terminationDate: term,
        contractType: "CLT",
        terminationType: "acordo",
      });
      expect(acordo.multa_fgts).toBeCloseTo(semJusta.multa_fgts / 2, 1);
    });
  });

  describe("Invariante cross-regime: mesmo input, regimes diferentes", () => {
    const baseInput = {
      salary: 5000,
      admissionDate: adm,
      terminationDate: term,
      terminationType: "sem_justa_causa" as const,
    };

    it("PJ.total < CLT.total para mesmo salário/tempo (sem encargos)", () => {
      const pj = calculateTermination({ ...baseInput, contractType: "PJ", terminationType: "distrato_imediato" });
      const clt = calculateTermination({ ...baseInput, contractType: "CLT" });
      expect(pj.total_rescisao).toBeLessThan(clt.total_rescisao);
    });

    it("estagio.total < CLT.total para mesmo salário/tempo", () => {
      const est = calculateTermination({ ...baseInput, contractType: "estagio" });
      const clt = calculateTermination({ ...baseInput, contractType: "CLT" });
      expect(est.total_rescisao).toBeLessThan(clt.total_rescisao);
    });
  });
});
