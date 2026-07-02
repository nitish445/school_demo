"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface SelectedChildContextValue {
  selectedChildId: string;
  setSelectedChildId: (id: string) => void;
}

const SelectedChildContext = createContext<SelectedChildContextValue | undefined>(undefined);

export function SelectedChildProvider({ children }: { children: ReactNode }) {
  const [selectedChildId, setSelectedChildId] = useState("");
  return (
    <SelectedChildContext.Provider value={{ selectedChildId, setSelectedChildId }}>
      {children}
    </SelectedChildContext.Provider>
  );
}

export function useSelectedChild() {
  const ctx = useContext(SelectedChildContext);
  if (!ctx) throw new Error("useSelectedChild must be used within a SelectedChildProvider");
  return ctx;
}
