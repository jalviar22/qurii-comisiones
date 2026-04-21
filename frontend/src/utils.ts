export function money(v: number | null | undefined): string {
  if (v == null) return "$ 0";
  return "$ " + Math.round(v).toLocaleString("es-CO");
}

export function pct(v: number | null | undefined, digits = 2): string {
  if (v == null) return "0%";
  return (v * 100).toFixed(digits) + "%";
}

export const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
