function buildFrontendPackageJson(projectSlug) {
  const body = {
    name: `${projectSlug}-frontend`,
    version: "0.1.0",
    private: true,
    type: "module",
    scripts: {
      dev: "vite",
      build: "vite build",
      preview: "vite preview",
      test: "echo \"No frontend tests configured yet\"",
    },
    dependencies: {
      react: "^18.3.1",
      "react-dom": "^18.3.1",
    },
    devDependencies: {
      "@vitejs/plugin-react": "^4.3.1",
      vite: "^5.4.8",
    },
  };

  return `${JSON.stringify(body, null, 2)}\n`;
}

module.exports = {
  buildFrontendPackageJson,
};
