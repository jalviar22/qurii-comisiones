import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { Layout } from "./components/Layout";
import { getCurrentUser } from "./api";
import { LoginPage } from "./pages/LoginPage";
import { RunsListPage } from "./pages/RunsListPage";
import { UploadPage } from "./pages/UploadPage";
import { RunDetailPage } from "./pages/RunDetailPage";
import { PersonDetailPage } from "./pages/PersonDetailPage";
import { RulesPage } from "./pages/RulesPage";

function Private({ children }: { children: React.ReactElement }) {
  const u = getCurrentUser();
  if (!u) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<Private><RunsListPage /></Private>} />
        <Route path="/upload" element={<Private><UploadPage /></Private>} />
        <Route path="/runs/:id" element={<Private><RunDetailPage /></Private>} />
        <Route path="/runs/:id/p/:cedula" element={<Private><PersonDetailPage /></Private>} />
        <Route path="/rules" element={<Private><RulesPage /></Private>} />
      </Routes>
    </BrowserRouter>
  );
}
