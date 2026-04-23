import { useEffect, useMemo, useState } from "react";
import {
  getCurrentUser,
  getRules,
  getTemplate,
  listBackups,
  listTemplates,
  restoreBackup,
  saveRules,
  type RulesBackup,
  type RulesTemplate,
} from "../api";

type Structure = Record<string, any>;
type Rules = {
  version?: number;
  description?: string;
  segundo_pago: { description?: string; tiers: Array<Record<string, any>> };
  structures: Structure[];
  constantes?: Record<string, any>;
};

const METRICS = [
  { value: "cantidad_contratos", label: "Cantidad de contratos" },
  { value: "monto_mm", label: "Monto en millones (MM)" },
];

const slugify = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function RulesPage() {
  const [rules, setRules] = useState<Rules | null>(null);
  const [rawMode, setRawMode] = useState(false);
  const [rawText, setRawText] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<RulesTemplate[]>([]);
  const [backups, setBackups] = useState<RulesBackup[]>([]);
  const [showBackups, setShowBackups] = useState(false);
  const [showNewStructure, setShowNewStructure] = useState(false);

  const user = getCurrentUser();
  const canEdit = user?.role === "admin";

  useEffect(() => {
    getRules().then((d) => {
      setRules(d);
      setRawText(JSON.stringify(d, null, 2));
    });
    listTemplates().then(setTemplates).catch(() => setTemplates([]));
    if (canEdit) {
      listBackups().then(setBackups).catch(() => setBackups([]));
    }
  }, [canEdit]);

  const dirty = useMemo(() => {
    if (!rules) return false;
    return rawMode
      ? rawText.trim() !== JSON.stringify(rules, null, 2).trim()
      : true;
  }, [rules, rawText, rawMode]);

  const flash = (text: string, isError = false) => {
    if (isError) { setErr(text); setMsg(""); } else { setMsg(text); setErr(""); }
    setTimeout(() => { setErr(""); setMsg(""); }, 4000);
  };

  const save = async () => {
    if (!rules) return;
    setSaving(true); setErr(""); setMsg("");
    try {
      const payload = rawMode ? JSON.parse(rawText) : rules;
      const saved = await saveRules(payload);
      setRules(saved);
      setRawText(JSON.stringify(saved, null, 2));
      if (canEdit) listBackups().then(setBackups).catch(() => {});
      flash("Reglas guardadas. Las próximas corridas usarán estas reglas.");
    } catch (e: any) {
      flash(e?.response?.data?.detail || e?.message || "Error al guardar", true);
    } finally {
      setSaving(false);
    }
  };

  const exportJSON = () => {
    if (!rules) return;
    const blob = new Blob([JSON.stringify(rules, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rules_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJSON = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Rules;
      if (!parsed.structures || !parsed.segundo_pago) throw new Error("JSON sin 'structures' o 'segundo_pago'");
      setRules(parsed);
      setRawText(JSON.stringify(parsed, null, 2));
      flash("JSON importado en memoria. Haz clic en 'Guardar reglas' para aplicarlo.");
    } catch (e: any) {
      flash(e?.message || "JSON inválido", true);
    }
  };

  const restoreLast = async () => {
    if (!backups.length) { flash("No hay backups disponibles.", true); return; }
    if (!confirm(`¿Restaurar el backup del ${fmtDate(backups[0].created_at)}?\nSe sobrescribirá la configuración actual (pero se guardará un backup automático del estado actual antes).`)) return;
    try {
      const restored = await restoreBackup(backups[0].id);
      setRules(restored);
      setRawText(JSON.stringify(restored, null, 2));
      listBackups().then(setBackups).catch(() => {});
      flash("Último backup restaurado.");
    } catch (e: any) {
      flash(e?.response?.data?.detail || e?.message || "Error al restaurar", true);
    }
  };

  const restoreSpecific = async (id: string, createdAt: string) => {
    if (!confirm(`¿Restaurar el backup del ${fmtDate(createdAt)}?\nSe sobrescribirá la configuración actual (se guardará un backup del estado actual antes).`)) return;
    try {
      const restored = await restoreBackup(id);
      setRules(restored);
      setRawText(JSON.stringify(restored, null, 2));
      listBackups().then(setBackups).catch(() => {});
      flash("Backup restaurado.");
    } catch (e: any) {
      flash(e?.response?.data?.detail || e?.message || "Error al restaurar", true);
    }
  };

  const updateStructure = (idx: number, updated: Structure) => {
    if (!rules) return;
    const next = { ...rules, structures: [...rules.structures] };
    next.structures[idx] = updated;
    setRules(next);
  };

  const deleteStructure = (idx: number) => {
    if (!rules) return;
    const s = rules.structures[idx];
    if (!confirm(`¿Eliminar la estructura "${s.name}" (${s.id})?\nEsta acción se puede deshacer con "Restaurar último backup" después de guardar.`)) return;
    const next = { ...rules, structures: rules.structures.filter((_, i) => i !== idx) };
    setRules(next);
    flash(`Estructura "${s.name}" eliminada (pendiente de guardar).`);
  };

  const addStructure = async (templateKey: string) => {
    if (!rules) return;
    try {
      const tpl = await getTemplate(templateKey);
      let newId = tpl.id;
      const existingIds = new Set(rules.structures.map((s) => s.id));
      let counter = 2;
      while (existingIds.has(newId)) {
        newId = `${tpl.id}_${counter++}`;
      }
      const next = { ...rules, structures: [...rules.structures, { ...tpl, id: newId }] };
      setRules(next);
      setExpanded({ ...expanded, [newId]: true });
      setShowNewStructure(false);
      flash(`Estructura "${tpl.name}" agregada (pendiente de guardar).`);
    } catch (e: any) {
      flash(e?.message || "Error al cargar plantilla", true);
    }
  };

  const updateSmlmv = (val: number) => {
    if (!rules) return;
    const next = { ...rules, constantes: { ...(rules.constantes || {}), SMLMV: val } };
    setRules(next);
  };

  const updateSegundoPagoTiers = (tiers: Array<Record<string, any>>) => {
    if (!rules) return;
    setRules({ ...rules, segundo_pago: { ...rules.segundo_pago, tiers } });
  };

  if (!rules) return <p className="note">Cargando…</p>;

  return (
    <>
      <h1>Reglas de comisiones</h1>

      <div className="card" style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <button className="btn" disabled={!canEdit || saving} onClick={save}>
          {saving ? "Guardando…" : "Guardar reglas"}
        </button>
        <button className="btn secondary" disabled={!canEdit || !backups.length} onClick={restoreLast}>
          Restaurar último backup
        </button>
        <button className="btn secondary" onClick={() => setShowBackups((v) => !v)}>
          Historial de backups ({backups.length})
        </button>
        <button className="btn secondary" onClick={exportJSON}>
          Exportar JSON
        </button>
        <label className="btn secondary" style={{ cursor: canEdit ? "pointer" : "not-allowed", opacity: canEdit ? 1 : 0.5 }}>
          Importar JSON
          <input
            type="file"
            accept="application/json"
            style={{ display: "none" }}
            disabled={!canEdit}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) importJSON(f); e.target.value = ""; }}
          />
        </label>
        <div style={{ flex: 1 }} />
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={rawMode} onChange={(e) => setRawMode(e.target.checked)} />
          Modo JSON avanzado
        </label>
      </div>

      {err && <div className="error" style={{ marginTop: 12 }}>{err}</div>}
      {msg && <div className="card" style={{ marginTop: 12, background: "#ecfdf5", color: "#065f46" }}>{msg}</div>}
      {!canEdit && (
        <div className="card" style={{ marginTop: 12, background: "#fef3c7", color: "#92400e" }}>
          Solo lectura — solo administradores pueden guardar cambios.
        </div>
      )}
      {dirty && !rawMode && (
        <div className="card" style={{ marginTop: 12, background: "#fef3c7", color: "#92400e" }}>
          Hay cambios sin guardar. Recuerda hacer clic en "Guardar reglas" arriba.
        </div>
      )}

      {showBackups && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Historial de backups</h3>
          {backups.length === 0 ? (
            <p className="note">Aún no hay backups. Cada vez que guardes se crea uno automáticamente.</p>
          ) : (
            <table className="table">
              <thead><tr><th>Fecha</th><th>Archivo</th><th>Tamaño</th><th></th></tr></thead>
              <tbody>
                {backups.map((b) => (
                  <tr key={b.id}>
                    <td>{fmtDate(b.created_at)}</td>
                    <td><code>{b.filename}</code></td>
                    <td className="money">{(b.size / 1024).toFixed(1)} KB</td>
                    <td>
                      <button className="btn secondary" disabled={!canEdit} onClick={() => restoreSpecific(b.id, b.created_at)}>
                        Restaurar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {rawMode ? (
        <div className="card">
          <p className="note">
            Modo avanzado: edita el JSON crudo. Se valida al guardar. Útil para cambios que no están en el editor visual.
          </p>
          <textarea
            className="input"
            style={{ fontFamily: "monospace", fontSize: 12, minHeight: 540 }}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            readOnly={!canEdit}
          />
        </div>
      ) : (
        <>
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Constantes globales</h2>
            <label className="note">SMLMV (salario mínimo legal)</label>
            <input
              type="number"
              className="input"
              value={rules.constantes?.SMLMV ?? 0}
              disabled={!canEdit}
              onChange={(e) => updateSmlmv(Number(e.target.value) || 0)}
              style={{ maxWidth: 220 }}
            />
            <p className="note" style={{ marginTop: 8 }}>
              Usado cuando una estructura define <code>garantizado: "SMLMV"</code>.
            </p>
          </div>

          <SegundoPagoEditor
            tiers={rules.segundo_pago.tiers}
            canEdit={!!canEdit}
            onChange={updateSegundoPagoTiers}
          />

          <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 style={{ margin: 0 }}>Estructuras comerciales ({rules.structures.length})</h2>
              <p className="note" style={{ marginBottom: 0 }}>Haz clic en cada una para expandir y editar sus reglas.</p>
            </div>
            <button className="btn" disabled={!canEdit} onClick={() => setShowNewStructure((v) => !v)}>
              + Nueva estructura
            </button>
          </div>

          {showNewStructure && (
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Elige una plantilla</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
                {templates.map((t) => (
                  <button
                    key={t.key}
                    className="card"
                    onClick={() => addStructure(t.key)}
                    style={{ cursor: "pointer", textAlign: "left", border: "1px solid var(--border)" }}
                  >
                    <b>{t.label}</b>
                    <p className="note" style={{ marginBottom: 0 }}>{t.description}</p>
                  </button>
                ))}
              </div>
              <button className="btn secondary" onClick={() => setShowNewStructure(false)} style={{ marginTop: 12 }}>
                Cancelar
              </button>
            </div>
          )}

          {rules.structures.map((s, idx) => (
            <StructureCard
              key={s.id + idx}
              structure={s}
              canEdit={!!canEdit}
              isExpanded={!!expanded[s.id]}
              onToggle={() => setExpanded({ ...expanded, [s.id]: !expanded[s.id] })}
              onChange={(updated) => updateStructure(idx, updated)}
              onDelete={() => deleteStructure(idx)}
              otherIds={rules.structures.filter((_, i) => i !== idx).map((x) => x.id)}
            />
          ))}
        </>
      )}
    </>
  );
}

// ================= Subcomponents =================

function SegundoPagoEditor({
  tiers,
  canEdit,
  onChange,
}: {
  tiers: Array<Record<string, any>>;
  canEdit: boolean;
  onChange: (t: Array<Record<string, any>>) => void;
}) {
  const update = (i: number, key: string, val: any) => {
    const next = tiers.map((t, j) => (j === i ? { ...t, [key]: val } : t));
    onChange(next);
  };
  const addRow = () => onChange([...tiers, { min_pct: 0, max_pct: 1, factor: 1, label: "Nuevo tramo" }]);
  const removeRow = (i: number) => onChange(tiers.filter((_, j) => j !== i));

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Regla maestra — Segundo Pago</h2>
      <p className="note">
        Factor que multiplica la comisión y el bono según el % de persistencia.
        Se aplica a todas las estructuras que tengan "Aplica segundo pago" activado.
      </p>
      <table className="table">
        <thead>
          <tr>
            <th>Persistencia desde</th>
            <th>Persistencia hasta</th>
            <th>Factor (paga)</th>
            <th>Etiqueta</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {tiers.map((t, i) => (
            <tr key={i}>
              <td><PctInput value={t.min_pct} disabled={!canEdit} onChange={(v) => update(i, "min_pct", v)} /></td>
              <td><PctInput value={t.max_pct} disabled={!canEdit} onChange={(v) => update(i, "max_pct", v)} /></td>
              <td><PctInput value={t.factor} disabled={!canEdit} onChange={(v) => update(i, "factor", v)} /></td>
              <td>
                <input
                  type="text"
                  className="input"
                  value={t.label || ""}
                  disabled={!canEdit}
                  onChange={(e) => update(i, "label", e.target.value)}
                />
              </td>
              <td>
                <button className="btn secondary" disabled={!canEdit} onClick={() => removeRow(i)}>
                  Quitar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="btn secondary" disabled={!canEdit} onClick={addRow} style={{ marginTop: 8 }}>
        + Agregar tramo
      </button>
    </div>
  );
}

function StructureCard({
  structure,
  canEdit,
  isExpanded,
  onToggle,
  onChange,
  onDelete,
  otherIds,
}: {
  structure: Structure;
  canEdit: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onChange: (s: Structure) => void;
  onDelete: () => void;
  otherIds: string[];
}) {
  const update = (key: string, val: any) => onChange({ ...structure, [key]: val });

  const setTiers = (tiers: any[]) => update("tiers", tiers);

  const hasKey = (key: string): boolean => Object.prototype.hasOwnProperty.call(structure, key);

  const addSection = (key: string, defaultVal: any) => update(key, defaultVal);
  const removeSection = (key: string) => {
    const next = { ...structure };
    delete next[key];
    onChange(next);
  };

  const tierColumns = useMemo(() => detectTierColumns(structure.tiers || []), [structure.tiers]);

  return (
    <div className="card" style={{ borderLeft: "4px solid var(--primary, #2563eb)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={onToggle}>
        <div>
          <h3 style={{ margin: 0 }}>
            {isExpanded ? "▼ " : "▶ "} {structure.name || "(sin nombre)"}
          </h3>
          <p className="note" style={{ margin: 0 }}>
            <code>{structure.id}</code> · {structure.company || "—"} · {structure.role || "—"} · {(structure.tiers || []).length} tiers
          </p>
        </div>
        <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", gap: 8 }}>
          <button className="btn secondary" disabled={!canEdit} onClick={onDelete}>
            Eliminar
          </button>
        </div>
      </div>

      {isExpanded && (
        <div style={{ marginTop: 16 }}>
          {/* ================= Datos básicos ================= */}
          <div className="grid-form" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            <FormField label="Nombre">
              <input
                type="text" className="input" value={structure.name || ""} disabled={!canEdit}
                onChange={(e) => {
                  const name = e.target.value;
                  // auto-sugerir ID si aún es el default o no se ha tocado
                  if (!structure.id || structure.id.startsWith("nueva_estructura")) {
                    const newId = slugify(name) || "nueva_estructura";
                    if (!otherIds.includes(newId)) onChange({ ...structure, name, id: newId });
                    else onChange({ ...structure, name });
                  } else onChange({ ...structure, name });
                }}
              />
            </FormField>
            <FormField label="ID (identificador único)">
              <input
                type="text" className="input" value={structure.id || ""} disabled={!canEdit}
                onChange={(e) => {
                  const id = slugify(e.target.value);
                  if (id && otherIds.includes(id)) return; // no permitir duplicar
                  update("id", id);
                }}
              />
            </FormField>
            <FormField label="Empresa">
              <input
                type="text" className="input" value={structure.company || ""} disabled={!canEdit}
                onChange={(e) => update("company", e.target.value)}
              />
            </FormField>
            <FormField label="Rol">
              <input
                type="text" className="input" value={structure.role || ""} disabled={!canEdit}
                onChange={(e) => update("role", e.target.value)}
              />
            </FormField>
            <FormField label="Métrica para tiers">
              <select
                className="select" value={structure.metric || "cantidad_contratos"} disabled={!canEdit}
                onChange={(e) => update("metric", e.target.value)}
              >
                {METRICS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </FormField>
            <FormField label="Persistencia mínima (0-1)">
              <PctInput
                value={structure.persistencia_minima || 0}
                disabled={!canEdit}
                onChange={(v) => update("persistencia_minima", v)}
              />
            </FormField>
          </div>

          <FormField label="Descripción">
            <textarea
              className="input"
              style={{ minHeight: 60 }}
              value={structure.description || ""}
              disabled={!canEdit}
              onChange={(e) => update("description", e.target.value)}
            />
          </FormField>

          {/* ================= Switches ================= */}
          <div className="card" style={{ background: "#f8fafc", marginTop: 12 }}>
            <h4 style={{ margin: "0 0 8px" }}>Reglas activas</h4>
            <Switch
              label="Aplica Segundo Pago (regla maestra por persistencia)"
              checked={structure.aplica_segundo_pago !== false}
              disabled={!canEdit}
              onChange={(v) => update("aplica_segundo_pago", v)}
            />
            <Switch
              label="Canal Aliado Comercial (AC) — % de comisión diferente cuando la persona es AC"
              checked={hasKey("canal_aliado_comercial_ac")}
              disabled={!canEdit}
              onChange={(v) => v ? addSection("canal_aliado_comercial_ac", { comision_pct: 0.002 }) : removeSection("canal_aliado_comercial_ac")}
            />
            <Switch
              label="Variable por persistencia (factor o categoría oro/diamante)"
              checked={hasKey("variable_por_persistencia")}
              disabled={!canEdit}
              onChange={(v) => v ? addSection("variable_por_persistencia", [{ min_pct: 0, max_pct: 1, factor: 1 }]) : removeSection("variable_por_persistencia")}
            />
            <Switch
              label="Ajuste por persistencia (GE Fonbienes)"
              checked={hasKey("ajuste_por_persistencia")}
              disabled={!canEdit}
              onChange={(v) => v ? addSection("ajuste_por_persistencia", [{ min_pct: 0, max_pct: 1, factor: 1 }]) : removeSection("ajuste_por_persistencia")}
            />
            <Switch
              label="Reglas especiales (asesor nuevo, factor sin-segundo-pago, etc.)"
              checked={hasKey("reglas_especiales")}
              disabled={!canEdit}
              onChange={(v) => v ? addSection("reglas_especiales", {}) : removeSection("reglas_especiales")}
            />
            <Switch
              label="Gerente Nuevo (GE 5G: umbral y % flat para primeros meses)"
              checked={hasKey("gerente_nuevo")}
              disabled={!canEdit}
              onChange={(v) => v ? addSection("gerente_nuevo", { comision_pct_flat: 0.0008, umbral_cantidad_tabla_antiguo: 15 }) : removeSection("gerente_nuevo")}
            />
          </div>

          {/* ================= Tiers ================= */}
          <TiersTable
            tiers={structure.tiers || []}
            columns={tierColumns}
            canEdit={canEdit}
            onChange={setTiers}
          />

          {/* ================= Secciones avanzadas (JSON editor inline) ================= */}
          {hasKey("variable_por_persistencia") && (
            <NestedJsonEditor
              title="Variable por persistencia"
              hint="Lista de tramos con min_pct / max_pct y factor (o categoría oro/diamante para GE 5G)."
              value={structure.variable_por_persistencia}
              canEdit={canEdit}
              onChange={(v) => update("variable_por_persistencia", v)}
            />
          )}
          {hasKey("ajuste_por_persistencia") && (
            <NestedJsonEditor
              title="Ajuste por persistencia"
              hint="Tramos con min_pct / max_pct y factor multiplicador."
              value={structure.ajuste_por_persistencia}
              canEdit={canEdit}
              onChange={(v) => update("ajuste_por_persistencia", v)}
            />
          )}
          {hasKey("canal_aliado_comercial_ac") && (
            <NestedJsonEditor
              title="Canal Aliado Comercial (AC)"
              hint="% de comisión cuando la persona es AC. Campos disponibles dependen del tipo de estructura (comision_pct, comision_pct_bajo, comision_hasta_X_pct, etc.)."
              value={structure.canal_aliado_comercial_ac}
              canEdit={canEdit}
              onChange={(v) => update("canal_aliado_comercial_ac", v)}
            />
          )}
          {hasKey("reglas_especiales") && (
            <NestedJsonEditor
              title="Reglas especiales"
              hint="Ejemplos: asesor_nuevo_meses, asesor_nuevo_garantiza_smlmv, bono_requiere_persistencia_min, sin_segundo_pago_factor."
              value={structure.reglas_especiales}
              canEdit={canEdit}
              onChange={(v) => update("reglas_especiales", v)}
            />
          )}
          {hasKey("gerente_nuevo") && (
            <NestedJsonEditor
              title="Gerente Nuevo"
              hint="Campos: comision_pct_flat, umbral_cantidad_tabla_antiguo."
              value={structure.gerente_nuevo}
              canEdit={canEdit}
              onChange={(v) => update("gerente_nuevo", v)}
            />
          )}
          {hasKey("bonos_trimestrales") && (
            <NestedJsonEditor
              title="Bonos trimestrales"
              hint="Lista de { concepto, valor }."
              value={structure.bonos_trimestrales}
              canEdit={canEdit}
              onChange={(v) => update("bonos_trimestrales", v)}
            />
          )}
          {hasKey("bonos_gestion_por_equipo") && (
            <NestedJsonEditor
              title="Bonos de gestión por equipo"
              hint="Lista de { rango_ventas, valor }."
              value={structure.bonos_gestion_por_equipo}
              canEdit={canEdit}
              onChange={(v) => update("bonos_gestion_por_equipo", v)}
            />
          )}

          {/* ================= Campos extra no mapeados ================= */}
          <ExtraFieldsEditor
            structure={structure}
            canEdit={canEdit}
            onChange={onChange}
          />
        </div>
      )}
    </div>
  );
}

const KNOWN_STRUCTURE_KEYS = new Set([
  "id", "name", "company", "role", "description", "metric",
  "persistencia_minima", "aplica_segundo_pago", "tiers",
  "variable_por_persistencia", "ajuste_por_persistencia",
  "canal_aliado_comercial_ac", "reglas_especiales", "gerente_nuevo",
  "bonos_trimestrales", "bonos_gestion_por_equipo",
  "monto_por_venta_equivalente_mm",
]);

function ExtraFieldsEditor({
  structure,
  canEdit,
  onChange,
}: {
  structure: Structure;
  canEdit: boolean;
  onChange: (s: Structure) => void;
}) {
  const extras = Object.keys(structure).filter((k) => !KNOWN_STRUCTURE_KEYS.has(k));
  const hasMontoEq = Object.prototype.hasOwnProperty.call(structure, "monto_por_venta_equivalente_mm");

  return (
    <div className="card" style={{ background: "#f8fafc", marginTop: 12 }}>
      <h4 style={{ margin: "0 0 8px" }}>Campos numéricos especiales</h4>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
        <FormField label="monto_por_venta_equivalente_mm (GE 5G)">
          <input
            type="number"
            className="input"
            value={structure.monto_por_venta_equivalente_mm ?? ""}
            disabled={!canEdit}
            placeholder="ej. 70"
            onChange={(e) => {
              const val = e.target.value === "" ? undefined : Number(e.target.value);
              const next = { ...structure };
              if (val === undefined) delete next.monto_por_venta_equivalente_mm;
              else next.monto_por_venta_equivalente_mm = val;
              onChange(next);
            }}
          />
          {hasMontoEq && <span className="note">Usado solo por GE 5G para calcular cantidad equivalente.</span>}
        </FormField>
      </div>
      {extras.length > 0 && (
        <>
          <p className="note" style={{ marginTop: 12 }}>
            Esta estructura tiene {extras.length} campo(s) no reconocido(s) por el editor visual. Para editarlos usa el <b>Modo JSON avanzado</b> arriba.
            Campos: {extras.map((k) => <code key={k} style={{ marginRight: 6 }}>{k}</code>)}
          </p>
        </>
      )}
    </div>
  );
}

function detectTierColumns(tiers: any[]): string[] {
  // Columnas fijas + cualquier key adicional que aparezca en el primer tier que no sea min/max
  const fixed = ["min", "max"];
  const first = tiers[0] || {};
  const extras = Object.keys(first).filter((k) => !fixed.includes(k));
  return [...fixed, ...extras];
}

function TiersTable({
  tiers,
  columns,
  canEdit,
  onChange,
}: {
  tiers: any[];
  columns: string[];
  canEdit: boolean;
  onChange: (t: any[]) => void;
}) {
  const update = (i: number, key: string, val: any) => {
    const next = tiers.map((t, j) => (j === i ? { ...t, [key]: val } : t));
    onChange(next);
  };
  const addRow = () => {
    const template = Object.fromEntries(columns.map((c) => {
      if (c === "min" || c === "max") return [c, null];
      if (c.includes("pct")) return [c, 0];
      return [c, 0];
    }));
    onChange([...tiers, template]);
  };
  const removeRow = (i: number) => onChange(tiers.filter((_, j) => j !== i));
  const addColumn = () => {
    const name = prompt("Nombre de la nueva columna (ej: 'comision_pct', 'bono', 'garantizado'):");
    if (!name) return;
    onChange(tiers.map((t) => ({ ...t, [name]: t[name] ?? 0 })));
  };

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h4 style={{ margin: 0 }}>Tiers (rangos)</h4>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="btn secondary" disabled={!canEdit} onClick={addColumn}>+ Columna</button>
          <button className="btn secondary" disabled={!canEdit} onClick={addRow}>+ Fila</button>
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              {columns.map((c) => <th key={c}>{c}</th>)}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {tiers.map((t, i) => (
              <tr key={i}>
                {columns.map((c) => (
                  <td key={c}>
                    <TierCell col={c} value={t[c]} disabled={!canEdit} onChange={(v) => update(i, c, v)} />
                  </td>
                ))}
                <td>
                  <button className="btn secondary" disabled={!canEdit} onClick={() => removeRow(i)}>Quitar</button>
                </td>
              </tr>
            ))}
            {tiers.length === 0 && (
              <tr><td colSpan={columns.length + 1} className="note">Sin tiers. Haz clic en "+ Fila".</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="note" style={{ marginTop: 8 }}>
        <b>Tip:</b> "min/max" definen el rango de la métrica. Deja "max" vacío para "sin límite superior".
        Columnas con "pct" se ingresan como decimal (0.014 = 1.4%). "bono" y "garantizado" son montos en pesos.
        "garantizado" acepta el texto literal <code>"SMLMV"</code> para usar el valor del salario mínimo.
      </p>
    </div>
  );
}

function TierCell({
  col,
  value,
  disabled,
  onChange,
}: {
  col: string;
  value: any;
  disabled: boolean;
  onChange: (v: any) => void;
}) {
  // garantizado acepta "SMLMV" (string) o número
  if (col === "garantizado") {
    const isSmlmv = value === "SMLMV";
    return (
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <input
          type={isSmlmv ? "text" : "number"}
          className="input"
          value={value ?? ""}
          disabled={disabled}
          style={{ width: 120 }}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "") onChange(0);
            else if (v === "SMLMV") onChange("SMLMV");
            else onChange(Number(v));
          }}
        />
        <button
          className="btn secondary" disabled={disabled}
          onClick={() => onChange(isSmlmv ? 0 : "SMLMV")}
          title="Alternar entre valor numérico y SMLMV"
        >
          {isSmlmv ? "#" : "SMLMV"}
        </button>
      </div>
    );
  }
  if (col === "max" || col === "min") {
    return (
      <input
        type="number"
        className="input"
        value={value === null || value === undefined ? "" : value}
        placeholder={col === "max" ? "∞" : "0"}
        disabled={disabled}
        style={{ width: 100 }}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? null : Number(v));
        }}
      />
    );
  }
  // pct columns: show as percent helper
  if (col.includes("pct")) {
    return <PctInput value={Number(value || 0)} disabled={disabled} onChange={onChange} />;
  }
  return (
    <input
      type="number"
      className="input"
      value={value ?? 0}
      disabled={disabled}
      style={{ width: 140 }}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
    />
  );
}

function PctInput({ value, disabled, onChange }: { value: number; disabled: boolean; onChange: (v: number) => void }) {
  // Internal value is a decimal (0.014); UI shows raw decimal and hint of %.
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <input
        type="number"
        step="0.0001"
        className="input"
        value={value}
        disabled={disabled}
        style={{ width: 100 }}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
      <span className="note" style={{ fontSize: 11 }}>
        ({(value * 100).toFixed(2)}%)
      </span>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
      <label className="note" style={{ fontSize: 12 }}>{label}</label>
      {children}
    </div>
  );
}

function Switch({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", cursor: disabled ? "not-allowed" : "pointer" }}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: 18, height: 18 }}
      />
      <span>{label}</span>
    </label>
  );
}

function NestedJsonEditor({
  title,
  hint,
  value,
  canEdit,
  onChange,
}: {
  title: string;
  hint?: string;
  value: any;
  canEdit: boolean;
  onChange: (v: any) => void;
}) {
  const [text, setText] = useState(JSON.stringify(value, null, 2));
  const [err, setErr] = useState("");

  useEffect(() => {
    setText(JSON.stringify(value, null, 2));
  }, [value]);

  const apply = () => {
    try {
      const parsed = JSON.parse(text);
      setErr("");
      onChange(parsed);
    } catch (e: any) {
      setErr(e?.message || "JSON inválido");
    }
  };

  return (
    <div className="card" style={{ background: "#f8fafc", marginTop: 12 }}>
      <h4 style={{ margin: "0 0 4px" }}>{title}</h4>
      {hint && <p className="note" style={{ marginTop: 0 }}>{hint}</p>}
      <textarea
        className="input"
        style={{ fontFamily: "monospace", fontSize: 12, minHeight: 120 }}
        value={text}
        disabled={!canEdit}
        onChange={(e) => setText(e.target.value)}
        onBlur={apply}
      />
      {err && <div className="error" style={{ marginTop: 4 }}>{err}</div>}
    </div>
  );
}
