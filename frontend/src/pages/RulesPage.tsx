import { useEffect, useState } from "react";
import { getRules, saveRules } from "../api";
import { getCurrentUser } from "../api";

export function RulesPage() {
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const user = getCurrentUser();
  const canEdit = user?.role === "admin";

  useEffect(() => {
    getRules().then((d) => setText(JSON.stringify(d, null, 2)));
  }, []);

  const save = async () => {
    setErr(""); setMsg(""); setSaving(true);
    try {
      const parsed = JSON.parse(text);
      await saveRules(parsed);
      setMsg("Reglas actualizadas. Las próximas corridas usarán estas reglas.");
    } catch (e: any) {
      setErr(e?.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <h1>Reglas de comisiones</h1>
      <div className="card">
        <p className="note">
          Este archivo define todas las tablas de comisiones. Se puede editar aquí para agregar,
          modificar o eliminar estructuras comerciales sin cambiar el código.
          {!canEdit && " (Solo lectura — solo administradores pueden guardar cambios.)"}
        </p>
        <textarea
          className="input"
          style={{ fontFamily: "monospace", fontSize: 12, minHeight: 540 }}
          value={text}
          onChange={(e) => setText(e.target.value)}
          readOnly={!canEdit}
        />
        {err && <div className="error">{err}</div>}
        {msg && <p className="note" style={{ color: "var(--success)" }}>{msg}</p>}
        {canEdit && (
          <button className="btn" style={{ marginTop: 12 }} onClick={save} disabled={saving}>
            {saving ? "Guardando..." : "Guardar reglas"}
          </button>
        )}
      </div>
    </>
  );
}
