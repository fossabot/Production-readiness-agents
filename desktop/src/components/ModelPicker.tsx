import type { ModelConfig } from "../../electron/types/settings.js";

interface ModelPickerProps {
  models: ModelConfig[];
  value: string;
  onChange: (modelId: string) => void;
  disabled?: boolean;
  recommendedModelId?: string;
  currentModelId?: string | null;
}

export function ModelPicker({
  models,
  value,
  onChange,
  disabled,
  recommendedModelId,
  currentModelId = null,
}: ModelPickerProps) {
  const grouped = models.reduce<Record<string, ModelConfig[]>>((acc, m) => {
    (acc[m.provider] ??= []).push(m);
    return acc;
  }, {});

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      style={{
        padding: "0.4rem 0.6rem",
        borderRadius: "6px",
        border: "1px solid #ddd",
        fontSize: "0.85rem",
        background: "#fff",
        minWidth: 180,
      }}
    >
      {Object.entries(grouped).map(([provider, providerModels]) => (
        <optgroup key={provider} label={provider}>
          {providerModels.map((m) => (
            <option key={m.id} value={m.id}>
              {m.displayName}
              {m.id === recommendedModelId ? " • موصى به" : ""}
              {currentModelId && m.id === currentModelId && m.id !== recommendedModelId ? " • الحالي" : ""}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
