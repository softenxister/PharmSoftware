import { useState } from "react";
import { TopBar } from "./components/TopBar";
import { Dashboard } from "./components/Dashboard";

export default function App() {
  const [activeNav, setActiveNav] = useState("Home");

  return (
    <div className="h-screen min-h-screen w-full flex flex-col overflow-hidden" style={{ background: "#f0f7f4", fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
      <TopBar activeNav={activeNav} onNavChange={setActiveNav} />
      <Dashboard />
    </div>
  );
}
