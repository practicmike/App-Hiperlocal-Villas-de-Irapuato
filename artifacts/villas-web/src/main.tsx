import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, staleTime: 30_000 },
  },
});

const base = import.meta.env.BASE_URL.replace(/\/$/, "");

// Instalable como app (PWA). En desarrollo no, para no guardar versiones viejas.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${base}/sw.js`).catch(() => {});
  });
}
// Android avisa antes de que React monte: se guarda el aviso para mostrarlo cuando convenga.
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  (window as unknown as { __villasInstall?: Event }).__villasInstall = e;
  window.dispatchEvent(new Event("villas-installable"));
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Router base={base}>
        <App />
      </Router>
    </QueryClientProvider>
  </StrictMode>,
);
