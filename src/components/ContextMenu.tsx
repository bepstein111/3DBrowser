import { useEffect, useLayoutEffect, useRef, useState } from "react";

export interface MenuItem {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  separatorBefore?: boolean;
}

interface Props {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

export default function ContextMenu({ x, y, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    setPos({
      x: Math.max(4, Math.min(x, window.innerWidth - rect.width - 4)),
      y: Math.max(4, Math.min(y, window.innerHeight - rect.height - 4)),
    });
  }, [x, y]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const onBlur = () => onClose();
    window.addEventListener("keydown", onKey);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("blur", onBlur);
    };
  }, [onClose]);

  return (
    <div
      className="context-backdrop"
      onClick={onClose}
      onContextMenu={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div
        ref={ref}
        className="context-menu"
        style={{ left: pos.x, top: pos.y }}
        onClick={(event) => event.stopPropagation()}
      >
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            className={`context-item${item.separatorBefore ? " separated" : ""}`}
            disabled={item.disabled}
            onClick={() => {
              item.onSelect();
              onClose();
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
