import { Link, useNavigate } from "react-router-dom";
import { getCurrentUser, logout } from "../api";

export function Layout({ children }: { children: React.ReactNode }) {
  const nav = useNavigate();
  const u = getCurrentUser();
  const doLogout = () => {
    logout();
    nav("/login", { replace: true });
  };
  return (
    <>
      <header className="header">
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <Link to="/" className="logo" style={{ color: "white" }}>Qurii · Comisiones</Link>
          <nav>
            <Link to="/">Corridas</Link>
            <Link to="/upload">Nueva corrida</Link>
            <Link to="/rules">Reglas</Link>
          </nav>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span className="user">{u?.full_name}</span>
          <button className="btn secondary" onClick={doLogout}>Salir</button>
        </div>
      </header>
      <div className="container">{children}</div>
    </>
  );
}
