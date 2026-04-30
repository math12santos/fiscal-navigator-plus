/** Converte campos `_id` vazios para `null` antes de enviar ao Supabase. */
export function sanitizeIdFields<T extends Record<string, any>>(payload: T): T {
  Object.keys(payload).forEach((k) => {
    if (k.endsWith("_id") && payload[k] === "") (payload as any)[k] = null;
  });
  return payload;
}
