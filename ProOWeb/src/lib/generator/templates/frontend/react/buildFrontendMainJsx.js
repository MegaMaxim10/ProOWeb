function buildFrontendMainJsx() {
  return `import React from "react";
import ReactDOM from "react-dom/client";
import { ShellApp } from "./modules/system/ui/ShellApp";
import "./shared/ui/app-shell.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ShellApp />
  </React.StrictMode>,
);
`;
}

module.exports = {
  buildFrontendMainJsx,
};
