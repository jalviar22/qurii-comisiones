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

export type Canal =
  | "Asesores Fonbienes"
  | "Asesores Serven"
  | "Gerente Equipo"
  | "Gerente Producto"
  | "Gerente Regional";

export const CANALES: Canal[] = [
  "Asesores Fonbienes",
  "Asesores Serven",
  "Gerente Equipo",
  "Gerente Producto",
  "Gerente Regional",
];

export function canalOf(r: { role: string; company: string }): Canal | "Otro" {
  if (r.role === "Asesor" && r.company === "Fonbienes") return "Asesores Fonbienes";
  if (r.role === "Asesor" && r.company === "Serven") return "Asesores Serven";
  if (r.role === "Gerente Equipo") return "Gerente Equipo";
  if (r.role === "Gerente Producto") return "Gerente Producto";
  if (r.role === "Gerente Regional") return "Gerente Regional";
  return "Otro";
}
