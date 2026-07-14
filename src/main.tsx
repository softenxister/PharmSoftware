import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router/dom";
import { AuthProvider } from "@/app/AuthProvider";
import { router } from "@/app/router";
import "@/styles/tailwind.css";
import "@/styles/theme.css";
import "@/styles/globals.css";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Pharm root element was not found.");

createRoot(rootElement).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>,
);
