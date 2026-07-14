import { createContext, useContext, useState, type ReactNode } from 'react';

interface PageTitleState {
  title: ReactNode;
  subtitle: ReactNode;
  setPageTitle: (title: ReactNode, subtitle?: ReactNode) => void;
}

const PageTitleContext = createContext<PageTitleState>({
  title: null, subtitle: null, setPageTitle: () => {},
});

export function PageTitleProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState<ReactNode>(null);
  const [subtitle, setSubtitle] = useState<ReactNode>(null);

  const setPageTitle = (t: ReactNode, s?: ReactNode) => {
    setTitle(t);
    setSubtitle(s ?? null);
  };

  return (
    <PageTitleContext.Provider value={{ title, subtitle, setPageTitle }}>
      {children}
    </PageTitleContext.Provider>
  );
}

export function usePageTitle() {
  return useContext(PageTitleContext);
}
