import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  adjustCommission, downloadWithAuth, getRun, pdfUrl,
} from "../api";
import type { CalculationRun, ComputedCommission } from "../api";
import { money, pct } from "../utils";

export function PersonDetailPage() {
  const { id = "", cedula = "" } = useParams();
  const [run, setRun] = useState<CalculationRun | null>(null);
  const [persona, setPersona] = useState<ComputedCommission | null>(null);
  const [ajuste, setAjuste] = useState(0);
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    getRun(id).then((r) => {
      setRun(r);
      const p = r.resultados.find((x) => x.cedula === cedula) || null;
      setPersona(p);
      if (p) {
        setAjuste(p.ajuste_manual);
        setMotivo(p.motivo_ajuste || "");
      }
    });
  }, [id, cedula]);

  const saveAjuste = async () => {
    setSaving(true);
    setMsg("");
    try {
      const updated = await adjustCommission(id, cedula, ajuste, motivo);
      setPersona(updated);
      setMsg("Ajuste guardado");
    } catch (e: any) {
      setMsg(e?.message || "Error");
    } finally {
      setSaving(false);
    }
  };

  if (!run || !persona) return <p className="note">Cargando…</p>;

  const total = persona.valor_total_a_pagar;

  return (
    <>
      <Link to={`/runs/${id}`}>← Volver a la corrida</Link>
      <h1 style={{ marginTop: 8 }}>{persona.nombre}</h1>
      <p className="note">
        Cédula: {persona.cedula} · {persona.role} · {persona.company} ·
        Estructura: <code>{persona.structure_id}</code>
      </p>

      <div className="grid-stats">
        <div className="card stat"><span className="label">Contratos</span><span className="value">{persona.cantidad_contratos}</span></div>
        <div className="card stat"><span className="label">Persistencia</span><span className="value">{pct(persona.porcentaje_persistencia)}</span></div>
        <div className="card stat"><span className="label">Segundo pago</span><span className="value">{pct(persona.porcentaje_segundo_pago)}</span></div>
        <div className="card stat"><span className="label">TOTAL a pagar</span><span className="value" style={{ color: "var(--primary)" }}>{money(total)}</span></div>
      </div>

      <div className="card">
        <h2>Desglose del cálculo</h2>
        <table className="table">
          <tbody>
            <tr><td>Monto base comisionable</td><td className="money">{money(persona.monto_base_comisionable)}</td></tr>
            <tr><td>% Comisión aplicado</td><td className="money">{pct(persona.porcentaje_comision, 4)}</td></tr>
            <tr><td>Factor variable persistencia</td><td className="money">{pct(persona.factor_variable_persistencia)}</td></tr>
            <tr><td>Factor Segundo Pago</td><td className="money">{pct(persona.factor_segundo_pago, 0)}</td></tr>
            <tr><td>Comisión base</td><td className="money">{money(persona.valor_comision_base)}</td></tr>
            <tr style={{ fontWeight: 600 }}><td>Comisión final</td><td className="money">{money(persona.valor_comision_final)}</td></tr>
            <tr><td>Garantizado</td><td className="money">{money(persona.valor_garantizado)}</td></tr>
            <tr><td>Bono</td><td className="money">{money(persona.valor_bono_final)}</td></tr>
            <tr><td>Ajuste manual</td><td className="money">{money(persona.ajuste_manual)}</td></tr>
            <tr style={{ fontWeight: 700, backgroundColor: "#eef5fb" }}>
              <td>TOTAL A PAGAR</td>
              <td className="money">{money(total)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {persona.notas?.length > 0 && (
        <div className="card">
          <h2>Notas del cálculo</h2>
          <ul>{persona.notas.map((n, i) => <li key={i}>{n}</li>)}</ul>
        </div>
      )}

      <div className="card">
        <h2>Ajuste manual</h2>
        <p className="note">Si identificas una situación especial, aquí puedes sumar/restar un valor al total.</p>
        <div className="row">
          <div>
            <label>Valor del ajuste</label>
            <input className="input" type="number" value={ajuste} onChange={(e) => setAjuste(+e.target.value)} />
          </div>
          <div>
            <label>Motivo</label>
            <input className="input" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. Bono discrecional Q2" />
          </div>
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center" }}>
          <button className="btn" onClick={saveAjuste} disabled={saving}>{saving ? "Guardando..." : "Guardar ajuste"}</button>
          <button className="btn secondary" onClick={() => downloadWithAuth(pdfUrl(id, cedula), `comision_${cedula}.pdf`)}>⬇ PDF individual</button>
          {msg && <span className="note">{msg}</span>}
        </div>
      </div>
    </>
  );
}
