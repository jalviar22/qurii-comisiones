import { useEffect, useState } from "react";
import {
  calcOpen,
  downloadOpenExcel,
  downloadOpenPdf,
  getRules,
} from "../api";
import type { ComputedCommission, OpenCalculatorInput } from "../api";
import { money, pct } from "../utils";

type Structure = {
  id: string;
  name: string;
  company?: string;
  role?: string;
};

const MANUAL_OPTION: Structure = {
  id: "manual",
  name: "Otra estructura (manual)",
  company: "—",
  role: "—",
};

const DEFAULT_INPUT: OpenCalculatorInput = {
  nombre: "",
  cedula: "",
  structure_id: "asesores_fonbienes_moto",
  structure_name_manual: "",
  porcentaje_persistencia: 0.85,
  monto_total_ventas: 0,
  cantidad_contratos: 0,
  aplica_segundo_pago: true,
  is_canal_ac: false,
  is_5g: false,
  antiguedad: "Antiguo",
  meses_antiguedad: null,
  porcentaje_comision_manual: null,
  bono_manual: null,
  salario_manual: null,
  notas: "",
};

export function CalculatorPage() {
  const [input, setInput] = useState<OpenCalculatorInput>(DEFAULT_INPUT);
  const [structures, setStructures] = useState<Structure[]>([]);
  const [result, setResult] = useState<ComputedCommission | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [overrideBono, setOverrideBono] = useState(false);
  const [overrideSalario, setOverrideSalario] = useState(false);
  const [overridePct, setOverridePct] = useState(false);

  useEffect(() => {
    getRules()
      .then((r) => {
        const list: Structure[] = (r.structures || []).map((s: Structure) => ({
          id: s.id,
          name: s.name,
          company: s.company,
          role: s.role,
        }));
        setStructures([...list, MANUAL_OPTION]);
      })
      .catch(() => setStructures([MANUAL_OPTION]));
  }, []);

  const update = <K extends keyof OpenCalculatorInput>(
    key: K,
    value: OpenCalculatorInput[K],
  ) => setInput((prev) => ({ ...prev, [key]: value }));

  const isManual = input.structure_id === "manual";

  const buildPayload = (): OpenCalculatorInput => ({
    ...input,
    porcentaje_comision_manual:
      isManual || overridePct ? input.porcentaje_comision_manual ?? 0 : null,
    bono_manual: overrideBono ? input.bono_manual ?? 0 : null,
    salario_manual: overrideSalario ? input.salario_manual ?? 0 : null,
    structure_name_manual: isManual ? input.structure_name_manual || "Estructura personalizada" : null,
    meses_antiguedad: input.antiguedad === "Nuevo" ? input.meses_antiguedad ?? 0 : null,
    notas: input.notas || null,
  });

  const calcular = async () => {
    setErr("");
    setResult(null);
    if (!input.nombre.trim() || !input.cedula.trim()) {
      setErr("Nombre y cédula son obligatorios");
      return;
    }
    if (isManual && (input.porcentaje_comision_manual ?? 0) <= 0 && (input.bono_manual ?? 0) === 0) {
      setErr("En modo manual ingresa al menos un % de comisión o un bono");
      return;
    }
    setLoading(true);
    try {
      const r = await calcOpen(buildPayload());
      setResult(r);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al calcular";
      setErr(msg);
    } finally {
      setLoading(false);
    }
  };

  const descargarExcel = () => {
    const safe = input.cedula.replace(/\D/g, "") || "sim";
    downloadOpenExcel(buildPayload(), `calculadora_${safe}.xlsx`);
  };
  const descargarPdf = () => {
    const safe = input.cedula.replace(/\D/g, "") || "sim";
    downloadOpenPdf(buildPayload(), `calculadora_${safe}.pdf`);
  };

  const limpiar = () => {
    setInput(DEFAULT_INPUT);
    setResult(null);
    setErr("");
    setOverrideBono(false);
    setOverrideSalario(false);
    setOverridePct(false);
  };

  const total = result ? result.valor_total_a_pagar : 0;

  return (
    <>
      <h1>Calculadora abierta</h1>
      <p className="note">
        Simula una comisión individual sin cargar Excel. Útil para asesores
        nuevos, casos fuera del flujo mensual o estructuras no parametrizadas.
      </p>

      <div className="card">
        <h2>Datos de la persona</h2>
        <div className="row">
          <div>
            <label>Nombre completo</label>
            <input
              className="input"
              value={input.nombre}
              onChange={(e) => update("nombre", e.target.value)}
              placeholder="Ej. Juan Pérez Rodríguez"
            />
          </div>
          <div>
            <label>Cédula</label>
            <input
              className="input"
              value={input.cedula}
              onChange={(e) => update("cedula", e.target.value)}
              placeholder="Ej. 1023456789"
            />
          </div>
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          <div>
            <label>Estructura comercial</label>
            <select
              className="select"
              value={input.structure_id}
              onChange={(e) => update("structure_id", e.target.value)}
            >
              {structures.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          {isManual && (
            <div>
              <label>Nombre de la estructura (manual)</label>
              <input
                className="input"
                value={input.structure_name_manual || ""}
                onChange={(e) => update("structure_name_manual", e.target.value)}
                placeholder="Ej. Consultor freelance"
              />
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h2>Resultados comerciales del mes</h2>
        <div className="row">
          <div>
            <label>Persistencia (%)</label>
            <input
              className="input"
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={input.porcentaje_persistencia * 100}
              onChange={(e) =>
                update("porcentaje_persistencia", Math.max(0, +e.target.value) / 100)
              }
            />
            <p className="note">Escribe el % tal cual (ej. 85 = 85%)</p>
          </div>
          <div>
            <label>Monto total de ventas</label>
            <input
              className="input"
              type="number"
              step="1"
              min="0"
              value={input.monto_total_ventas}
              onChange={(e) => update("monto_total_ventas", Math.max(0, +e.target.value))}
            />
            <p className="note">{money(input.monto_total_ventas)}</p>
          </div>
          <div>
            <label>Cantidad de contratos</label>
            <input
              className="input"
              type="number"
              step="1"
              min="0"
              value={input.cantidad_contratos}
              onChange={(e) => update("cantidad_contratos", Math.max(0, +e.target.value))}
            />
          </div>
        </div>

        {!isManual && (
          <div className="row" style={{ marginTop: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, flex: "none" }}>
              <input
                type="checkbox"
                checked={input.aplica_segundo_pago}
                onChange={(e) => update("aplica_segundo_pago", e.target.checked)}
              />
              Aplica Segundo Pago
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, flex: "none" }}>
              <input
                type="checkbox"
                checked={input.is_canal_ac}
                onChange={(e) => update("is_canal_ac", e.target.checked)}
              />
              Canal Aliado Comercial (AC)
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, flex: "none" }}>
              <input
                type="checkbox"
                checked={input.antiguedad === "Nuevo"}
                onChange={(e) => update("antiguedad", e.target.checked ? "Nuevo" : "Antiguo")}
              />
              Asesor nuevo
            </label>
            {input.antiguedad === "Nuevo" && (
              <div style={{ maxWidth: 180 }}>
                <label>Meses de antigüedad</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  value={input.meses_antiguedad ?? 0}
                  onChange={(e) => update("meses_antiguedad", Math.max(0, +e.target.value))}
                />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card">
        <h2>Comisión, bono y salario</h2>
        {isManual ? (
          <>
            <p className="note">
              En modo manual la fórmula es: <b>monto × % de comisión + bono + salario</b>.
            </p>
            <div className="row">
              <div>
                <label>% Comisión (sobre el monto)</label>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={(input.porcentaje_comision_manual ?? 0) * 100}
                  onChange={(e) =>
                    update(
                      "porcentaje_comision_manual",
                      Math.max(0, +e.target.value) / 100,
                    )
                  }
                />
              </div>
              <div>
                <label>Bono (monto fijo)</label>
                <input
                  className="input"
                  type="number"
                  step="1"
                  min="0"
                  value={input.bono_manual ?? 0}
                  onChange={(e) => update("bono_manual", Math.max(0, +e.target.value))}
                />
                <p className="note">{money(input.bono_manual ?? 0)}</p>
              </div>
              <div>
                <label>Salario / garantizado</label>
                <input
                  className="input"
                  type="number"
                  step="1"
                  min="0"
                  value={input.salario_manual ?? 0}
                  onChange={(e) => update("salario_manual", Math.max(0, +e.target.value))}
                />
                <p className="note">{money(input.salario_manual ?? 0)}</p>
              </div>
            </div>
          </>
        ) : (
          <>
            <p className="note">
              Por defecto el sistema toma el % de comisión y los bonos de las
              tablas configuradas. Actívalos abajo si quieres forzar un valor.
            </p>
            <div className="row" style={{ alignItems: "flex-start" }}>
              <div>
                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={overridePct}
                    onChange={(e) => setOverridePct(e.target.checked)}
                  />
                  Forzar % de comisión
                </label>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  disabled={!overridePct}
                  value={(input.porcentaje_comision_manual ?? 0) * 100}
                  onChange={(e) =>
                    update(
                      "porcentaje_comision_manual",
                      Math.max(0, +e.target.value) / 100,
                    )
                  }
                />
              </div>
              <div>
                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={overrideBono}
                    onChange={(e) => setOverrideBono(e.target.checked)}
                  />
                  Bono manual
                </label>
                <input
                  className="input"
                  type="number"
                  step="1"
                  min="0"
                  disabled={!overrideBono}
                  value={input.bono_manual ?? 0}
                  onChange={(e) => update("bono_manual", Math.max(0, +e.target.value))}
                />
                <p className="note">{money(input.bono_manual ?? 0)}</p>
              </div>
              <div>
                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={overrideSalario}
                    onChange={(e) => setOverrideSalario(e.target.checked)}
                  />
                  Salario garantizado
                </label>
                <input
                  className="input"
                  type="number"
                  step="1"
                  min="0"
                  disabled={!overrideSalario}
                  value={input.salario_manual ?? 0}
                  onChange={(e) => update("salario_manual", Math.max(0, +e.target.value))}
                />
                <p className="note">{money(input.salario_manual ?? 0)}</p>
              </div>
            </div>
          </>
        )}

        <div style={{ marginTop: 12 }}>
          <label>Notas / observaciones (aparecerán en el PDF)</label>
          <input
            className="input"
            value={input.notas || ""}
            onChange={(e) => update("notas", e.target.value)}
            placeholder="Opcional: motivo del pago, aclaraciones, etc."
          />
        </div>
      </div>

      {err && <div className="error">{err}</div>}
      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <button className="btn" onClick={calcular} disabled={loading}>
          {loading ? "Calculando..." : "Calcular"}
        </button>
        <button className="btn secondary" onClick={limpiar} disabled={loading}>
          Limpiar
        </button>
      </div>

      {result && (
        <>
          <div className="grid-stats">
            <div className="card stat">
              <span className="label">Persona</span>
              <span className="value" style={{ fontSize: 16 }}>{result.nombre}</span>
            </div>
            <div className="card stat">
              <span className="label">Cédula</span>
              <span className="value" style={{ fontSize: 16 }}>{result.cedula}</span>
            </div>
            <div className="card stat">
              <span className="label">Estructura</span>
              <span className="value" style={{ fontSize: 14 }}>{result.structure_id}</span>
            </div>
            <div className="card stat">
              <span className="label">TOTAL a pagar</span>
              <span className="value" style={{ color: "var(--primary)" }}>{money(total)}</span>
            </div>
          </div>

          <div className="card">
            <h2>Desglose del cálculo</h2>
            <table className="table">
              <tbody>
                <tr><td>Monto base comisionable</td><td className="money">{money(result.monto_base_comisionable)}</td></tr>
                <tr><td>% Comisión aplicado</td><td className="money">{pct(result.porcentaje_comision, 4)}</td></tr>
                <tr><td>Factor variable persistencia</td><td className="money">{pct(result.factor_variable_persistencia)}</td></tr>
                <tr><td>Factor Segundo Pago</td><td className="money">{pct(result.factor_segundo_pago, 0)}</td></tr>
                <tr><td>Comisión base</td><td className="money">{money(result.valor_comision_base)}</td></tr>
                <tr style={{ fontWeight: 600 }}><td>Comisión final</td><td className="money">{money(result.valor_comision_final)}</td></tr>
                <tr><td>Garantizado</td><td className="money">{money(result.valor_garantizado)}</td></tr>
                <tr><td>Bono</td><td className="money">{money(result.valor_bono_final)}</td></tr>
                <tr><td>Salario</td><td className="money">{money(result.valor_salario)}</td></tr>
                <tr style={{ fontWeight: 700, backgroundColor: "#eef5fb" }}>
                  <td>TOTAL A PAGAR</td>
                  <td className="money">{money(total)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {result.notas.length > 0 && (
            <div className="card">
              <h2>Notas del cálculo</h2>
              <ul>{result.notas.map((n, i) => <li key={i}>{n}</li>)}</ul>
            </div>
          )}

          <div className="card">
            <h2>Exportar para pago</h2>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button className="btn" onClick={descargarExcel}>⬇ Descargar Excel</button>
              <button className="btn secondary" onClick={descargarPdf}>⬇ Descargar PDF</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
