// Centralized inline SVG set. Tree-shakes well and avoids dragging in a full icon library.

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const base = (props: IconProps) => ({
  width: props.size ?? 16,
  height: props.size ?? 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...props,
});

export const ChevronLeft = (p: IconProps) => (
  <svg {...base(p)}><polyline points="15 18 9 12 15 6" /></svg>
);
export const ChevronRight = (p: IconProps) => (
  <svg {...base(p)}><polyline points="9 18 15 12 9 6" /></svg>
);
export const Search = (p: IconProps) => (
  <svg {...base(p)}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
);
export const Bell = (p: IconProps) => (
  <svg {...base(p)}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10 21a2 2 0 0 0 4 0" /></svg>
);
export const Sidebar = (p: IconProps) => (
  <svg {...base(p)}><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="9" y1="3" x2="9" y2="21" /></svg>
);
export const Sort = (p: IconProps) => (
  <svg {...base(p)}><path d="M3 6h18M6 12h12M10 18h4" /></svg>
);
export const Filter = (p: IconProps) => (
  <svg {...base(p)}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
);
export const Download = (p: IconProps) => (
  <svg {...base(p)}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
);
export const FileText = (p: IconProps) => (
  <svg {...base(p)}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
);
export const Grid = (p: IconProps) => (
  <svg {...base(p)}><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" /></svg>
);
export const ExternalLink = (p: IconProps) => (
  <svg {...base(p)}><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" /></svg>
);
export const MessageSquare = (p: IconProps) => (
  <svg {...base(p)}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
);
export const Check = (p: IconProps) => (
  <svg {...base({ ...p, strokeWidth: 3 })}><polyline points="20 6 9 17 4 12" /></svg>
);
export const User = (p: IconProps) => (
  <svg {...base(p)}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
);
export const Book = (p: IconProps) => (
  <svg {...base(p)}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
);
export const Link = (p: IconProps) => (
  <svg {...base(p)}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
);
export const X = (p: IconProps) => (
  <svg {...base(p)}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
);
export const Sparkles = (p: IconProps) => (
  <svg {...base(p)}><path d="M12 3l1.9 5.8L20 11l-6.1 1.9L12 19l-1.9-6.1L4 11l6.1-2.2L12 3z" /></svg>
);
export const ArrowRight = (p: IconProps) => (
  <svg {...base(p)}><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
);
