import { useEffect, useRef, useState } from "react";

interface Props {
  title: string;
  label?: string;
  initialValue?: string;
  confirmLabel?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export default function PromptDialog({
  title,
  label,
  initialValue = "",
  confirmLabel = "Create",
  onConfirm,
  onCancel,
}: Props) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const submit = () => {
    const trimmed = value.trim();
    if (trimmed) onConfirm(trimmed);
  };

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="prompt-dialog" onClick={(event) => event.stopPropagation()}>
        <h3 className="prompt-title">{title}</h3>
        {label && <label className="prompt-label">{label}</label>}
        <input
          ref={inputRef}
          className="prompt-input"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") submit();
            if (event.key === "Escape") onCancel();
          }}
        />
        <div className="prompt-actions">
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={submit}
            disabled={!value.trim()}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
