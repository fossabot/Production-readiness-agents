import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import { useEffect } from "react";
import { ScanPage } from "./pages/ScanPage.js";
import { ProgressPage } from "./pages/ProgressPage.js";
import { ReportPage } from "./pages/ReportPage.js";
import { SettingsPage } from "./pages/SettingsPage.js";
import { HistoryPage } from "./pages/HistoryPage.js";
import { useRunStore } from "./state/run-store.js";
import { ipc } from "./lib/ipc-client.js";

export function App() {
  const handleWorkerEvent = useRunStore((s) => s.handleWorkerEvent);

  useEffect(() => {
    const unsubscribe = ipc.onRunEvent(handleWorkerEvent);
    return unsubscribe;
  }, [handleWorkerEvent]);

  return (
    <BrowserRouter>
      <div style={{ display: "flex", height: "100vh" }}>
        <nav style={{ width: 220, background: "#1a1a2e", color: "#fff", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <h2 style={{ fontSize: "1rem", marginBottom: "1rem" }}>Production Readiness</h2>
          <NavLink to="/" style={navStyle}>فحص جديد</NavLink>
          <NavLink to="/progress" style={navStyle}>التقدم</NavLink>
          <NavLink to="/report" style={navStyle}>التقرير</NavLink>
          <NavLink to="/history" style={navStyle}>السجل</NavLink>
          <NavLink to="/settings" style={navStyle}>الإعدادات</NavLink>
        </nav>
        <main style={{ flex: 1, padding: "1.5rem", overflow: "auto", background: "#f5f5f5" }}>
          <Routes>
            <Route path="/" element={<ScanPage />} />
            <Route path="/progress" element={<ProgressPage />} />
            <Route path="/progress/:runId" element={<ProgressPage />} />
            <Route path="/report" element={<ReportPage />} />
            <Route path="/report/:runId" element={<ReportPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/history" element={<HistoryPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

function navStyle({ isActive }: { isActive: boolean }) {
  return {
    color: "#fff",
    textDecoration: "none",
    padding: "0.5rem 1rem",
    borderRadius: "6px",
    background: isActive ? "#16213e" : "transparent",
    display: "block",
  };
}
