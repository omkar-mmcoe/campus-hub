interface IconProps {
  name: string;
  size?: number;
  filled?: boolean;
  className?: string;
}

/**
 * Material Symbols (Outlined) icon. The font is loaded in src/routes/__root.tsx.
 */
export function Icon({ name, size = 20, filled = false, className = "" }: IconProps) {
  return (
    <span
      className={`material-symbols-outlined select-none ${className}`}
      aria-hidden="true"
      style={{
        fontSize: size,
        lineHeight: 1,
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' ${size}`,
      }}
    >
      {name}
    </span>
  );
}
