function buildFrontendPackageJson(projectSlug, options = {}) {
  const cypressE2eEnabled = Boolean(options.cypressE2eEnabled);
  const scripts = {
    dev: "vite",
    build: "vite build",
    preview: "vite preview",
    test: "npm run test:unit --if-present",
    "test:unit": "vitest run --passWithNoTests",
    "test:unit:watch": "vitest",
  };

  if (cypressE2eEnabled) {
    scripts["dev:e2e"] = "vite --host 127.0.0.1 --port 5173 --strictPort";
    scripts["cy:open"] = "cypress open";
    scripts["cy:run"] = "cypress run";
    scripts["test:e2e"] = "cypress run --browser electron";
    scripts["test:e2e:ci"] = "start-server-and-test dev:e2e http://127.0.0.1:5173 \"cypress run --browser electron --headless\"";
    scripts["test:e2e:headed"] = "start-server-and-test dev:e2e http://127.0.0.1:5173 \"cypress run --browser electron --headed\"";
    scripts["test:e2e:open"] = "start-server-and-test dev:e2e http://127.0.0.1:5173 \"cypress open --e2e --browser electron\"";
  }

  const body = {
    name: `${projectSlug}-frontend`,
    version: "0.1.0",
    private: true,
    type: "module",
    scripts,
    dependencies: {
      react: "^18.3.1",
      "react-dom": "^18.3.1",
    },
    devDependencies: {
      "@vitejs/plugin-react": "^4.3.1",
      "@testing-library/jest-dom": "^6.6.3",
      "@testing-library/react": "^16.0.1",
      jsdom: "^25.0.1",
      vitest: "^2.1.3",
      vite: "^5.4.8",
    },
  };

  if (cypressE2eEnabled) {
    body.devDependencies.cypress = "^13.17.0";
    body.devDependencies["start-server-and-test"] = "^2.0.10";
  }

  return `${JSON.stringify(body, null, 2)}\n`;
}

module.exports = {
  buildFrontendPackageJson,
};
