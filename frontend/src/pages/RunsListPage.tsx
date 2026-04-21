import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listRuns } from "../api";
import type { RunSummary } from "../api";
import { MESES, money } from "../utils";

export function RunsListPage() {
  const [runs, setRuns] = useState<RunSummary[] | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    listRuns().then(setRuns).catch((e) => setErr(e?.message || "Error"));
  }, []);

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Corridas de comisiones</h1>
        <Link className="btn" to="/upload">+ Nueva corrida</Link>
      </div>
      {err && <div className="error">{err}</div>}
      <div className="card">
        {runs === null ? (
          <p className="note">Cargando…</p>
        ) : runs.length === 0 ? (
          <p className="note">
            No hay corridas todavía. Haz clic en <b>+ Nueva corrida</b> para subir los 5 Excel del mes.
          </p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Período</th>
                <th>Fecha</th>
                <th>Creada por</th>
                <th style={{ textAlign: "right" }}># Personas</th>
                <th style={{ textAlign: "right" }}>Total a pagar</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id}>
                  <td><b>{MESES[r.mes_cierre - 1]} {r.anio_cierre}</b></td>
                  <td>{new Date(r.created_at).toLocaleString("es-CO")}</td>
                  <td>{r.created_by}</td>
                  <td className="money">{r.total_registros}</td>
                  <td className="money">{money(r.total_a_pagar)}</td>
                  <td><Link to={`/runs/${r.id}`}>Ver →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
