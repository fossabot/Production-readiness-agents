import { useState } from "react";
import { ipc } from "../lib/ipc-client.js";

interface RepoSelectorProps {
  value: string;
  onChange: (path: string) => void;
  disabled?: boolean;
}

export function RepoSelector({ value, onChange, disabled }: RepoSelectorProps) {
  const [error, setError] = useState<string | null>(null);

  const handleBrowse = async () => {
    try {
      const result = await ipc.selectFolder();
      if (result.path) {
        onChange(result.path);
        setError(null);
      }
    } catch (err) {
      setError("فشل فتح نافذة اختيار المجلد");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <label style={{ fontWeight: 600, fontSize: "0.9rem" }}>مسار المستودع</label>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <input
          type="text"
          value={value}
          onChange={(e) => { onChange(e.target.value); setError(null); }}
          placeholder="اختر مجلد المستودع المحلي..."
          disabled={disabled}
          style={{
            flex: 1,
            padding: "0.6rem 1rem",
            border: "1px solid #ddd",
            borderRadius: "6px",
            fontSize: "0.9rem",
            direction: "ltr",
            textAlign: "left",
          }}
        />
        <button
          onClick={handleBrowse}
          disabled={disabled}
          style={{
            padding: "0.6rem 1.2rem",
            background: "#2d3748",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.5 : 1,
          }}
        >
          تصفح
        </button>
      </div>
      {error && <span style={{ color: "#e53e3e", fontSize: "0.8rem" }}>{error}</span>}
    </div>
  );
}
