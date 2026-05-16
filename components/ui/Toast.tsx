"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

type ToastCtx = { show: (msg: string) => void };
const Ctx = createContext<ToastCtx>({ show: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((m: string) => {
    setMsg(m);
    setVisible(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setVisible(false), 1800);
  }, []);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className={
          "fixed left-1/2 bottom-6 z-50 -translate-x-1/2 rounded-lg bg-text px-4 py-2.5 text-[13px] text-white shadow-md transition-all " +
          (visible ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0 pointer-events-none")
        }
      >
        {msg}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  return useContext(Ctx);
}
