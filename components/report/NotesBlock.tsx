import type { NotesItem } from "@/lib/types";
import { Cite } from "@/components/ui/Cite";

function renderList(items: NotesItem[], depth = 0) {
  return (
    <ul className={depth === 0 ? "mb-4 list-disc pl-6" : "mt-1 list-[circle] pl-6"}>
      {items.map((item, i) => (
        <li key={i} className="mb-1.5 text-sm text-text">
          {item.text} <Cite n={i + 1} />
          {item.children && renderList(item.children, depth + 1)}
        </li>
      ))}
    </ul>
  );
}

export function NotesBlock({ title, items }: { title?: string; items: NotesItem[] }) {
  return (
    <div className="mt-7">
      {title && <h4 className="mb-2 text-sm font-semibold">{title}:</h4>}
      {renderList(items)}
    </div>
  );
}
