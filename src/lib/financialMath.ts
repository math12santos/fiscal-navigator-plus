/**
 * Helpers de matemática financeira centralizados.
 * Manter aqui evita divergência de arredondamento entre módulos (parcelamentos,
 * rateios, conciliação) e garante consistência contábil.
 */

/** Arredonda para 2 casas (centavos), evitando bugs de ponto flutuante. */
export function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/**
 * Divide um valor em N parcelas iguais sem perder centavos.
 * A última parcela absorve o resíduo (= valor - soma das anteriores).
 *
 * Exemplo: split(100, 3) → [33.33, 33.33, 33.34]
 */
export function splitInstallments(total: number, n: number): number[] {
  const safeN = Math.max(1, Math.floor(n || 1));
  if (safeN === 1) return [round2(total)];
  const base = round2(total / safeN);
  const parcels = new Array(safeN - 1).fill(base);
  const last = round2(total - base * (safeN - 1));
  parcels.push(last);
  return parcels;
}

/**
 * Distribui um valor em chaves arbitrárias respeitando percentuais (0–100)
 * que somam ~100. Última chave absorve o resíduo.
 */
export function prorateByPercent<K extends string>(
  total: number,
  percentByKey: Record<K, number>,
): Record<K, number> {
  const keys = Object.keys(percentByKey) as K[];
  if (keys.length === 0) return {} as Record<K, number>;
  const result = {} as Record<K, number>;
  let acc = 0;
  for (let i = 0; i < keys.length - 1; i++) {
    const v = round2((total * (percentByKey[keys[i]] || 0)) / 100);
    result[keys[i]] = v;
    acc += v;
  }
  result[keys[keys.length - 1]] = round2(total - acc);
  return result;
}

/** Saldo acumulado dia a dia. Útil para gráfico de runway. */
export function runningBalance(
  ordered: { date: string; delta: number }[],
  initial = 0,
): { date: string; balance: number }[] {
  let acc = initial;
  return ordered.map((p) => {
    acc = round2(acc + p.delta);
    return { date: p.date, balance: acc };
  });
}
