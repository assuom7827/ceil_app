/**
 * Formatage de dates centralisé — configurable via NEXT_PUBLIC_DATE_FORMAT (.env).
 *
 * Tokens supportés : DD (jour 2 chiffres), MM (mois 2 chiffres),
 *                    YYYY (année 4 chiffres), YY (année 2 chiffres).
 *
 * Par défaut, les dates sont formatées dans le fuseau local.
 * Le paramètre `utc` force l'usage des méthodes UTC (pour les documents officiels).
 */
export type NullableDate = Date | string | null | undefined;

const FORMAT = process.env.NEXT_PUBLIC_DATE_FORMAT || 'DD/MM/YYYY';

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatDate(value: NullableDate, utc = false): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const d = utc ? date.getUTCDate() : date.getDate();
  const m = utc ? date.getUTCMonth() + 1 : date.getMonth() + 1;
  const y = utc ? date.getUTCFullYear() : date.getFullYear();

  let result = FORMAT;
  result = result.replace(/YYYY/g, String(y));
  result = result.replace(/YY/g, String(y).slice(-2));
  result = result.replace(/DD/g, pad(d));
  result = result.replace(/MM/g, pad(m));
  return result;
}

export function formatDateUTC(value: NullableDate): string {
  return formatDate(value, true);
}
