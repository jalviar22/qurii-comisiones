import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createRun } from "../api";
import { MESES } from "../utils";

export function UploadPage() {
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [anio, setAnio] = useState(now.getFullYear());
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  const addFiles = (fs: FileList | null) => {
    if (!fs) return;
    const next = [...files];
    for (const f of Array.from(fs)) {
      if (!next.find((x) => x.name === f.name)) next.push(f);
    }
    setFiles(next);
  };

  const submit = async () => {
    setErr("");
    if (files.length === 0) {
      setErr("Debes subir al menos un Excel");
      return;
    }
    setLoading(true);
    try {
      const run = await createRun(mes, anio, files);
      nav(`/runs/${run.id}`);
    } catch (e: any) {
      const d = e?.response?.data?.detail;
      setErr(typeof d === "string" ? d : JSON.stringify(d || e?.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h1>Nueva corrida de comisiones</h1>
      <div className="card">
        <div className="row">
          <div>
            <label>Mes de cierre</label>
            <select className="select" value={mes} onChange={(e) => setMes(+e.target.value)}>
              {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label>Año</label>
            <input className="input" type="number" value={anio} onChange={(e) => setAnio(+e.target.value)} />
          </div>
        </div>
      </div>
      <div
        className={`dropzone ${dragging ? "over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
        onClick={() => document.getElementById("file-input")?.click()}
      >
        <input
          id="file-input"
          type="file"
          multiple
          accept=".xlsx,.xls"
          style={{ display: "none" }}
          onChange={(e) => addFiles(e.target.files)}
        />
        <p style={{ margin: 0, fontWeight: 600, fontSize: 16 }}>
          Arrastra aquí los 5 Excel del mes o haz clic para seleccionarlos
        </p>
        <p className="note">Asesores Fonbienes · Asesores Serven · GE · GP · GR (detección automática)</p>
      </div>
      {files.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h2>Archivos seleccionados ({files.length})</h2>
          <ul>
            {files.map((f) => (
              <li key={f.name}>
                {f.name} <span className="note">({(f.size / 1024).toFixed(0)} KB)</span>
                <button
                  className="btn secondary"
                  style={{ marginLeft: 8, padding: "2px 8px", fontSize: 12 }}
                  onClick={() => setFiles(files.filter((x) => x.name !== f.name))}
                >quitar</button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {err && <div className="error">{err}</div>}
      <div style={{ marginTop: 16 }}>
        <button className="btn" onClick={submit} disabled={loading}>
          {loading ? "Procesando..." : "Calcular comisiones"}
        </button>
      </div>
    </>
  );
}
