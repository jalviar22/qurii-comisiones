import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { downloadWithAuth, excelUrl, getRun } from "../api";
import type { CalculationRun } from "../api";
import { MESES, money, pct } from "../utils";

export function RunDetailPage() {
  const { id = "" } = useParams();
  const [run, setRun] = useState<CalculationRun | null>(null);
  const [filter, setFilter] = useState("");
  const [onlyDiscrep, setOnlyDiscrep] = useState(false);
  const [structureFilter, setStructureFilter] = useState("all");

  useEffect(() => { getRun(id).then(setRun); }, [id]);

  const filtered = useMemo(() => {
    if (!run) return [];
    const q = filter.toLowerCase();
    return run.resultados.filter((r) => {
      if (onlyDiscrep && !r.discrepancia) return false;
      if (structureFilter !== "all" && r.structure_id !== structureFilter) return false;
      if (!q) return true;
      return (
        r.nombre.toLowerCase().includes(q) ||
        r.cedula.toLowerCase().includes(q) ||
        r.structure_id.toLowerCase().includes(q)
      );
    });
  }, [run, filter, onlyDiscrep, structureFilter]);

  const stats = useMemo(() => {
    if (!run) return { total: 0, pagan: 0, discrepancias: 0, por_rol: {} as Record<string, number> };
    const por_rol: Record<string, number> = {};
    let pagan = 0, discrepancias = 0;
    for (const r of run.resultados) {
      por_rol[r.role] = (por_rol[r.role] || 0) + r.valor_total_a_pagar;
      if (r.valor_total_a_pagar > 0) pagan++;
      if (r.discrepancia) discrepancias++;
    }
    return { total: run.total_a_pagar, pagan, discrepancias, por_rol };
  }, [run]);

  const structures = useMemo(() => {
    if (!run) return [] as string[];
    return Array.from(new Set(run.resultados.map((r) => r.structure_id))).sort();
  }, [run]);

  if (!run) return <p className="note">Cargando…</p>;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>{MESES[run.mes_cierre - 1]} {run.anio_cierre}</h1>
        <button
          className="btn"
          onClick={() => downloadWithAuth(excelUrl(run.id), `consolidado_${run.anio_cierre}_${run.mes_cierre}.xlsx`)}
        >⬇ Descargar Excel consolidado</button>
      </div>

      <div className="grid-stats">
        <div className="card stat"><span className="label">Total a pagar</span><span className="value">{money(stats.total)}</span></div>
        <div className="card stat"><span className="label">Personas</span><span className="value">{run.total_registros}</span></div>
        <div className="card stat"><span className="label">Con pago &gt; 0</span><span className="value">{stats.pagan}</span></div>
        <div className="card stat"><span className="label">Discrepancias con sistema</span><span className="value" style={{ color: stats.discrepancias ? "var(--danger)" : "var(--success)" }}>{stats.discrepancias}</span></div>
      </div>

      <div className="card">
        <h2>Totales por rol</h2>
        <table className="table">
          <thead><tr><th>Rol</th><th className="money">Total</th></tr></thead>
          <tbody>
            {Object.entries(stats.por_rol).map(([k, v]) => (
              <tr key={k}><td>{k}</td><td className="money">{money(v)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="row" style={{ marginBottom: 12 }}>
          <input className="input" placeholder="Buscar por nombre, cédula o estructura…"
                 value={filter} onChange={(e) => setFilter(e.target.value)} />
          <select className="select" value={structureFilter} onChange={(e) => setStructureFilter(e.target.value)}>
            <option value="all">Todas las estructuras</option>
            {structures.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <label style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
            <input type="checkbox" checked={onlyDiscrep} onChange={(e) => setOnlyDiscrep(e.target.checked)} />
            Solo discrepancias
          </label>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Persona</th>
              <th>Estructura</th>
              <th className="money"># Contr.</th>
              <th className="money">Persistencia</th>
              <th className="money">%Com</th>
              <th className="money">Comisión</th>
              <th className="money">Bono</th>
              <th className="money">Garantizado</th>
              <th className="money">Ajuste</th>
              <th className="money">TOTAL</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.cedula} className={r.discrepancia ? "discrep" : ""}>
                <td>
                  <b>{r.nombre}</b><br />
                  <span className="note">{r.cedula} · {r.company}</span>
                </td>
                <td><span className="badge gray">{r.structure_id}</span></td>
                <td className="money">{r.cantidad_contratos}</td>
                <td className="money">{pct(r.porcentaje_persistencia)}</td>
                <td className="money">{pct(r.porcentaje_comision, 4)}</td>
                <td className="money">{money(r.valor_comision_final)}</td>
                <td className="money">{money(r.valor_bono_final)}</td>
                <td className="money">{money(r.valor_garantizado)}</td>
                <td className="money">{r.ajuste_manual ? money(r.ajuste_manual) : "—"}</td>
                <td className="money"><b>{money(r.valor_total_a_pagar)}</b></td>
                <td><Link to={`/runs/${run.id}/p/${r.cedula}`}>Ver →</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
