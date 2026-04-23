import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem("qurii_token");
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

export interface User {
  email: string;
  full_name: string;
  role: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface ComputedCommission {
  cedula: string;
  nombre: string;
  company: string;
  role: string;
  structure_id: string;
  cantidad_contratos: number;
  porcentaje_persistencia: number;
  porcentaje_segundo_pago: number;
  monto_base_comisionable: number;
  porcentaje_comision: number;
  factor_variable_persistencia: number;
  factor_segundo_pago: number;
  valor_comision_base: number;
  valor_comision_final: number;
  valor_garantizado: number;
  valor_bono: number;
  valor_bono_final: number;
  valor_salario: number;
  valor_total_a_pagar: number;
  discrepancia: boolean;
  notas: string[];
  ajuste_manual: number;
  motivo_ajuste: string | null;
}

export interface CalculationRun {
  id: string;
  mes_cierre: number;
  anio_cierre: number;
  created_at: string;
  created_by: string;
  total_registros: number;
  total_a_pagar: number;
  resultados: ComputedCommission[];
}

export interface RunSummary {
  id: string;
  mes_cierre: number;
  anio_cierre: number;
  created_at: string;
  created_by: string;
  total_registros: number;
  total_a_pagar: number;
}

export async function login(email: string, password: string): Promise<TokenResponse> {
  const form = new URLSearchParams();
  form.append("username", email);
  form.append("password", password);
  const { data } = await api.post<TokenResponse>("/api/auth/login", form);
  localStorage.setItem("qurii_token", data.access_token);
  localStorage.setItem("qurii_user", JSON.stringify(data.user));
  return data;
}

export function logout() {
  localStorage.removeItem("qurii_token");
  localStorage.removeItem("qurii_user");
}

export function getCurrentUser(): User | null {
  const s = localStorage.getItem("qurii_user");
  return s ? (JSON.parse(s) as User) : null;
}

export async function listRuns(): Promise<RunSummary[]> {
  const { data } = await api.get<RunSummary[]>("/api/runs");
  return data;
}

export async function getRun(id: string): Promise<CalculationRun> {
  const { data } = await api.get<CalculationRun>(`/api/runs/${id}`);
  return data;
}

export async function createRun(
  mes: number,
  anio: number,
  files: File[],
): Promise<CalculationRun> {
  const fd = new FormData();
  fd.append("mes", String(mes));
  fd.append("anio", String(anio));
  for (const f of files) fd.append("files", f);
  const { data } = await api.post<CalculationRun>("/api/runs", fd);
  return data;
}

export async function adjustCommission(
  runId: string,
  cedula: string,
  ajuste: number,
  motivo: string,
): Promise<ComputedCommission> {
  const fd = new FormData();
  fd.append("ajuste", String(ajuste));
  fd.append("motivo", motivo);
  const { data } = await api.post<ComputedCommission>(
    `/api/runs/${runId}/adjust/${cedula}`,
    fd,
  );
  return data;
}

export function excelUrl(runId: string): string {
  return `${API_URL}/api/runs/${runId}/excel`;
}

export function pdfUrl(runId: string, cedula: string): string {
  return `${API_URL}/api/runs/${runId}/pdf/${cedula}`;
}

export async function downloadWithAuth(url: string, filename: string): Promise<void> {
  const res = await api.get(url.replace(API_URL, ""), { responseType: "blob" });
  const blobUrl = URL.createObjectURL(res.data as Blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(blobUrl);
}

// ===== Calculadora abierta (simulación individual) =====

export interface OpenCalculatorInput {
  nombre: string;
  cedula: string;
  structure_id: string;
  structure_name_manual?: string | null;
  porcentaje_persistencia: number;
  monto_total_ventas: number;
  cantidad_contratos: number;
  aplica_segundo_pago: boolean;
  is_canal_ac: boolean;
  is_5g: boolean;
  antiguedad: "Nuevo" | "Antiguo";
  meses_antiguedad?: number | null;
  porcentaje_comision_manual?: number | null;
  bono_manual?: number | null;
  salario_manual?: number | null;
  notas?: string | null;
}

export async function calcOpen(input: OpenCalculatorInput): Promise<ComputedCommission> {
  const { data } = await api.post<ComputedCommission>("/api/calculator/open", input);
  return data;
}

export async function downloadOpenExcel(input: OpenCalculatorInput, filename: string): Promise<void> {
  const res = await api.post("/api/calculator/open/excel", input, { responseType: "blob" });
  const blobUrl = URL.createObjectURL(res.data as Blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(blobUrl);
}

export async function downloadOpenPdf(input: OpenCalculatorInput, filename: string): Promise<void> {
  const res = await api.post("/api/calculator/open/pdf", input, { responseType: "blob" });
  const blobUrl = URL.createObjectURL(res.data as Blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(blobUrl);
}

export async function getRules(): Promise<any> {
  const { data } = await api.get("/api/rules");
  return data;
}

export async function saveRules(rules: any): Promise<any> {
  const { data } = await api.put("/api/rules", rules);
  return data;
}
