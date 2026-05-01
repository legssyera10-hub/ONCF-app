export function OncfLogo({
  className = "",
  label = "ONCF",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <svg
      viewBox="0 0 360 96"
      aria-label={label}
      role="img"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <g fill="none" stroke="#f28c00" strokeLinecap="round">
        <path d="M24 61 C56 50, 86 29, 116 9" strokeWidth="6" />
        <path d="M16 73 C58 62, 108 31, 156 8" strokeWidth="8" />
        <path d="M10 86 C70 73, 140 36, 212 8" strokeWidth="10" />
      </g>
      <text
        x="144"
        y="76"
        fill="#f28c00"
        fontSize="64"
        fontWeight="800"
        fontStyle="italic"
        fontFamily="Arial, Helvetica, sans-serif"
        letterSpacing="1"
      >
        ONCF
      </text>
    </svg>
  );
}
