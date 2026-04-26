import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface GeneratingContextType {
  isGenerating: boolean;
  setGenerating: (value: boolean) => void;
}

const GeneratingContext = createContext<GeneratingContextType>({
  isGenerating: false,
  setGenerating: () => {},
});

export function GeneratingProvider({ children }: { children: ReactNode }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const setGenerating = useCallback((value: boolean) => setIsGenerating(value), []);
  return (
    <GeneratingContext.Provider value={{ isGenerating, setGenerating }}>
      {children}
    </GeneratingContext.Provider>
  );
}

export function useGenerating() {
  return useContext(GeneratingContext);
}
