import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { downloadWithAuth, excelUrl, getRun } from "../api";
import type { CalculationRun } from "../api";
import { CANALES, canalOf, MESES, money, pct, type Canal } from "../utils";

export function RunDetailPage() {
  const { id = "" } = useParams();
  const [run, setRun] = useState<CalculationRun | null>(null);
  const [filter, setFilter] = useState("");
  const [onlyDiscrep, setOnlyDiscrep] = useState(false);
  const [structureFilter, setStructureFilter] = useState("all");
  const [canalFilter, setCanalFilter] = useState<Canal | "all">("all");

  useEffect(() => { getRun(id).then(setRun); }, [id]);

  const filtered = useMemo(() => {
    if (!run) return [];
    const q = filter.toLowerCase();
    return run.resultados.filter((r) => {
      if (onlyDiscrep && !r.discrepancia) return false;
      if (structureFilter !== "all" && r.structure_id !== structureFilter) return false;
      if (canalFilter !== "all" && canalOf(r) !== canalFilter) return false;
      if (!q) return true;
      return (
        r.nombre.toLowerCase().includes(q) ||
        r.cedula.toLowerCase().includes(q) ||
        r.structure_id.toLowerCase().includes(q)
      );
    });
  }, [run, filter, onlyDiscrep, structureFilter, canalFilter]);

  type Totales = {
    n: number;
    comision: number;
    bono: number;
    garantizado: number;
    ajuste: number;
    total: number;
  };
  const zero = (): Totales => ({ n: 0, comision: 0, bono: 0, garantizado: 0, ajuste: 0, total: 0 });

  const sumRows = (rows: NonNullable<typeof run>["resultados"]): Totales => {
    const t = zero();
    for (const r of rows) {
      t.n += 1;
      t.comision += r.valor_comision_final;
      t.bono += r.valor_bono_final;
      t.garantizado += r.valor_garantizado;
      t.ajuste += r.ajuste_manual;
      t.total += r.valor_total_a_pagar + r.ajuste_manual;
    }
    return t;
  };

  const stats = useMemo(() => {
    const emptyCanales = Object.fromEntries(
      CANALES.map((c) => [c, { total: 0, personas: 0, pagan: 0 }])
    ) as Record<Canal, { total: number; personas: number; pagan: number }>;
    if (!run) {
      return {
        total: 0,
        pagan: 0,
        discrepancias: 0,
        por_canal: emptyCanales,
        por_estructura: {} as Record<string, Totales>,
      };
    }
    const por_canal = emptyCanales;
    const por_estructura: Record<string, Totales> = {};
    let pagan = 0, discrepancias = 0;
    for (const r of run.resultados) {
      const c = canalOf(r);
      if (c !== "Otro") {
        por_canal[c].total += r.valor_total_a_pagar;
        por_canal[c].personas += 1;
        if (r.valor_total_a_pagar > 0) por_canal[c].pagan += 1;
      }
      if (!por_estructura[r.structure_id]) por_estructura[r.structure_id] = zero();
      const t = por_estructura[r.structure_id];
      t.n += 1;
      t.comision += r.valor_comision_final;
      t.bono += r.valor_bono_final;
      t.garantizado += r.valor_garantizado;
      t.ajuste += r.ajuste_manual;
      t.total += r.valor_total_a_pagar + r.ajuste_manual;
      if (r.valor_total_a_pagar > 0) pagan++;
      if (r.discrepancia) discrepancias++;
    }
    return { total: run.total_a_pagar, pagan, discrepancias, por_canal, por_estructura };
  }, [run]);

  const filteredTotals = useMemo(() => sumRows(filtered), [filtered]);

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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Totales por canal</h2>
          {canalFilter !== "all" && (
            <button className="btn secondary" onClick={() => setCanalFilter("all")}>Limpiar filtro</button>
          )}
        </div>
        <div className="grid-canales">
          {CANALES.map((c) => {
            const s = stats.por_canal[c];
            const active = canalFilter === c;
            return (
              <button
                key={c}
                className={`card canal-card${active ? " active" : ""}`}
                onClick={() => setCanalFilter(active ? "all" : c)}
                title={active ? "Quitar filtro" : `Ver solo ${c}`}
              >
                <span className="label">{c}</span>
                <span className="value">{money(s.total)}</span>
                <span className="note">{s.pagan} / {s.personas} personas</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="card">
        <h2>Totales por estructura</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Estructura</th>
              <th className="money">Personas</th>
              <th className="money">Comisión</th>
              <th className="money">Bono</th>
              <th className="money">Garantizado</th>
              <th className="money">Ajuste</th>
              <th className="money">Total</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(stats.por_estructura).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => (
              <tr
                key={k}
                onClick={() => setStructureFilter(k === structureFilter ? "all" : k)}
                style={{ cursor: "pointer", background: k === structureFilter ? "var(--bg-hover, #f1f5f9)" : undefined }}
              >
                <td><b>{k}</b></td>
                <td className="money">{v.n}</td>
                <td className="money">{money(v.comision)}</td>
                <td className="money">{money(v.bono)}</td>
                <td className="money">{money(v.garantizado)}</td>
                <td className="money">{v.ajuste ? money(v.ajuste) : "—"}</td>
                <td className="money"><b>{money(v.total)}</b></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="note" style={{ marginTop: 8 }}>Tip: clic en una fila para filtrar la tabla de abajo por esa estructura.</p>
      </div>

      <div className="card">
        <div className="row" style={{ marginBottom: 12 }}>
          <input className="input" placeholder="Buscar por nombre, cédula o estructura…"
                 value={filter} onChange={(e) => setFilter(e.target.value)} />
          <select className="select" value={canalFilter} onChange={(e) => setCanalFilter(e.target.value as Canal | "all")}>
            <option value="all">Todos los canales</option>
            {CANALES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="select" value={structureFilter} onChange={(e) => setStructureFilter(e.target.value)}>
            <option value="all">Todas las estructuras</option>
            {structures.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <label style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
            <input type="checkbox" checked={onlyDiscrep} onChange={(e) => setOnlyDiscrep(e.target.checked)} />
            Solo discrepancias
          </label>
        </div>

        <div className="grid-stats" style={{ marginBottom: 12 }}>
          <div className="card stat"><span className="label">Personas filtradas</span><span className="value">{filteredTotals.n}</span></div>
          <div className="card stat"><span className="label">Comisión</span><span className="value">{money(filteredTotals.comision)}</span></div>
          <div className="card stat"><span className="label">Bono</span><span className="value">{money(filteredTotals.bono)}</span></div>
          <div className="card stat"><span className="label">Garantizado</span><span className="value">{money(filteredTotals.garantizado)}</span></div>
          <div className="card stat"><span className="label">Ajuste</span><span className="value">{money(filteredTotals.ajuste)}</span></div>
          <div className="card stat"><span className="label">Total filtrado</span><span className="value">{money(filteredTotals.total)}</span></div>
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
