import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { Bootstrap } from "./components/Bootstrap.tsx";

createRoot(document.getElementById("root")!).render(
  <Bootstrap>
    <App />
  </Bootstrap>
);
