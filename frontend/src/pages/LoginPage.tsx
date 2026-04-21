import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../api";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      await login(email, password);
      nav("/", { replace: true });
    } catch (e: any) {
      setErr(e?.response?.data?.detail || "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <h1>Qurii Comisiones</h1>
        <p>Inicia sesión para continuar</p>
        <div className="field">
          <label>Correo</label>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
        </div>
        <div className="field">
          <label>Contraseña</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {err && <div className="error">{err}</div>}
        <button className="btn" style={{ width: "100%", marginTop: 10 }} disabled={loading}>
          {loading ? "Ingresando..." : "Ingresar"}
        </button>
        <p className="note" style={{ marginTop: 18 }}>
          Usuarios iniciales: juanpabloalviar@gmail.com · yenny.suarez@qurii.co · martha.ramos@qurii.co
          <br />
          Contraseña inicial: <code>qurii2025</code> (cámbiala al primer uso)
        </p>
      </form>
    </div>
  );
}
