"use client";

import { useEffect, useState } from "react";

// Visual-only placeholder for the prompt textarea: types the example text
// out character by character on mount, then leaves a blinking caret at the
// end. Doesn't touch the textarea's actual value — clicking in and typing
// just replaces the overlay normally because the textarea's real `value`
// stays empty until the user types.
//
// Props:
//   text     — the full placeholder string to type out.
//   visible  — show the overlay when true. Caller hides it once the user
//              has typed anything (i.e., draft is non-empty).

const CHAR_INTERVAL_MS = 28;

export function AnimatedPlaceholder({ text, visible }: { text: string; visible: boolean }) {
  const [shown, setShown] = useState("");

  // Restart the animation whenever the target text changes (e.g. workflow
  // switch). Also re-runs when the user clears the textarea so they get the
  // typewriter again rather than a static placeholder.
  useEffect(() => {
    setShown("");
    if (!visible) return;
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) window.clearInterval(id);
    }, CHAR_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [text, visible]);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-5 top-5 select-none text-[16px] leading-relaxed text-[#9CA3AF] dark:text-[#8E8E8E]"
    >
      {shown}
      <span className="evoke-caret" />
    </div>
  );
}
