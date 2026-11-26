import { avatarParts, type AvatarParts } from "@/lib/avatars";

function Body({ shape, color }: { shape: AvatarParts["shape"]; color: string }) {
  switch (shape) {
    case "box":
      return <rect x="18" y="24" width="64" height="62" rx="18" fill={color} />;
    case "ghost":
      return (
        <path
          d="M18 56a32 32 0 0 1 64 0v30l-8-6-8 6-8-6-8 6-8-6-8 6-8-6-8 6z"
          fill={color}
        />
      );
    default:
      return <ellipse cx="50" cy="56" rx="33" ry="31" fill={color} />;
  }
}

function Extra({ kind, color }: { kind: AvatarParts["extra"]; color: string }) {
  switch (kind) {
    case "antenna":
      return (
        <g stroke={color} strokeWidth="4" strokeLinecap="round">
          <line x1="50" y1="26" x2="50" y2="12" />
          <circle cx="50" cy="10" r="5" fill="#fde047" stroke="none" />
        </g>
      );
    case "ears":
      return (
        <g fill={color}>
          <circle cx="24" cy="30" r="10" />
          <circle cx="76" cy="30" r="10" />
        </g>
      );
    case "horns":
      return (
        <g fill="#fef3c7">
          <path d="M28 32 22 12l16 14z" />
          <path d="M72 32l6-20-16 14z" />
        </g>
      );
    case "leaf":
      return <path d="M50 26c0-10 8-16 18-16-2 10-8 16-18 16z" fill="#4ade80" />;
    default:
      return null;
  }
}

function Eyes({ kind }: { kind: AvatarParts["eyes"] }) {
  switch (kind) {
    case "big":
      return (
        <g>
          <circle cx="38" cy="50" r="9" fill="#fff" />
          <circle cx="62" cy="50" r="9" fill="#fff" />
          <circle cx="40" cy="52" r="4.5" fill="#0f172a" />
          <circle cx="64" cy="52" r="4.5" fill="#0f172a" />
        </g>
      );
    case "sleepy":
      return (
        <g stroke="#0f172a" strokeWidth="3.5" strokeLinecap="round" fill="none">
          <path d="M31 51q7 6 14 0" />
          <path d="M55 51q7 6 14 0" />
        </g>
      );
    case "wink":
      return (
        <g>
          <circle cx="38" cy="50" r="5" fill="#0f172a" />
          <path d="M56 50h13" stroke="#0f172a" strokeWidth="3.5" strokeLinecap="round" />
        </g>
      );
    default:
      return (
        <g fill="#0f172a">
          <circle cx="38" cy="50" r="5" />
          <circle cx="62" cy="50" r="5" />
        </g>
      );
  }
}

function Mouth({ kind }: { kind: AvatarParts["mouth"] }) {
  const stroke = { stroke: "#0f172a", strokeWidth: 3.5, strokeLinecap: "round" as const, fill: "none" };
  switch (kind) {
    case "open":
      return <ellipse cx="50" cy="69" rx="7" ry="6" fill="#0f172a" />;
    case "flat":
      return <path d="M42 69h16" {...stroke} />;
    case "tongue":
      return (
        <g>
          <path d="M40 66q10 10 20 0" {...stroke} />
          <path d="M47 70q3 7 6 0" fill="#fb7185" />
        </g>
      );
    default:
      return <path d="M39 65q11 11 22 0" {...stroke} />;
  }
}

/** One of 24 original procedurally-drawn creatures. */
export function Avatar({ id, size = 48, className = "" }: { id: string; size?: number; className?: string }) {
  const p = avatarParts(id);
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={`shrink-0 rounded-full ${className}`}
      aria-hidden
    >
      <defs>
        <clipPath id={`clip-${id}`}>
          <circle cx="50" cy="50" r="46" />
        </clipPath>
      </defs>
      <circle cx="50" cy="50" r="46" fill={p.bg} />
      <g clipPath={`url(#clip-${id})`}>
        <Extra kind={p.extra} color={p.body} />
        <Body shape={p.shape} color={p.body} />
      </g>
      <ellipse cx="40" cy="40" rx="9" ry="5" fill="#fff" opacity="0.3" />
      <Eyes kind={p.eyes} />
      <Mouth kind={p.mouth} />
      {/* Sticker outline */}
      <circle cx="50" cy="50" r="46" fill="none" stroke="#17130f" strokeWidth="6" />
    </svg>
  );
}
