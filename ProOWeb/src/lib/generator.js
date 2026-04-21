const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const PROFILE_PORTS = {
  dev: { backend: 8080, frontend: 3000, database: 5432 },
  demo: { backend: 8180, frontend: 3100, database: 5532 },
  test: { backend: 8280, frontend: 3200, database: 5632 },
  preprod: { backend: 8380, frontend: 3300, database: 5732 },
  prod: { backend: 8480, frontend: 3400, database: 5832 },
};

function ensureExecutable(targetPath) {
  try {
    fs.chmodSync(targetPath, 0o755);
  } catch (_) {
    // noop on environments where chmod is not relevant
  }
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeYamlDoubleQuotes(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/\"/g, "\\\"");
}

function toPosixPath(value) {
  return String(value).replace(/\\/g, "/");
}

function hashContent(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function makeWriter(rootDir, registry) {
  const resolvedRoot = path.resolve(rootDir);

  return function writeManagedFile(targetPath, content) {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, content, "utf8");

    const relativePath = toPosixPath(path.relative(resolvedRoot, targetPath));
    registry.push({
      path: relativePath,
      sha256: hashContent(content),
    });
  };
}

function buildBackendPomXml(projectTitle, projectSlug, swaggerEnabled) {
  const swaggerDependency = swaggerEnabled
    ? `\n    <dependency>\n      <groupId>org.springdoc</groupId>\n      <artifactId>springdoc-openapi-starter-webmvc-ui</artifactId>\n      <version>2.6.0</version>\n    </dependency>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>

  <parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.3.5</version>
    <relativePath/>
  </parent>

  <groupId>com.prooweb.generated</groupId>
  <artifactId>${escapeXml(projectSlug)}-backend</artifactId>
  <version>0.0.1-SNAPSHOT</version>
  <name>${escapeXml(projectTitle)} Backend</name>
  <description>Generated backend for ${escapeXml(projectTitle)}</description>

  <properties>
    <java.version>21</java.version>
  </properties>

  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-actuator</artifactId>
    </dependency>${swaggerDependency}

    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-test</artifactId>
      <scope>test</scope>
    </dependency>
  </dependencies>

  <build>
    <plugins>
      <plugin>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-maven-plugin</artifactId>
      </plugin>
    </plugins>
  </build>
</project>
`;
}

function buildBackendApplicationJava() {
  return `package com.prooweb.generated;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class ProowebApplication {
  public static void main(String[] args) {
    SpringApplication.run(ProowebApplication.class, args);
  }
}
`;
}

function buildBackendCorsConfigJava() {
  return `package com.prooweb.generated.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebCorsConfig implements WebMvcConfigurer {
  @Override
  public void addCorsMappings(CorsRegistry registry) {
    registry
      .addMapping("/**")
      .allowedOriginPatterns("*")
      .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
      .allowedHeaders("*");
  }
}
`;
}

function buildWorkspaceMetaControllerJava() {
  return `package com.prooweb.generated.api;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class WorkspaceMetaController {

  @Value("\${app.site-title:ProOWeb Generated App}")
  private String siteTitle;

  @Value("\${app.stack.backend:springboot}")
  private String backend;

  @Value("\${app.stack.database:postgresql}")
  private String database;

  @Value("\${app.backend.swagger-ui.enabled:false}")
  private boolean swaggerEnabled;

  @Value("\${app.backend.swagger-ui.profiles:}")
  private String swaggerProfiles;

  @GetMapping("/meta")
  public Map<String, Object> readMeta() {
    List<String> profiles = Arrays
      .stream(swaggerProfiles.split(","))
      .map(String::trim)
      .filter(value -> !value.isEmpty())
      .collect(Collectors.toList());

    return Map.of(
      "siteTitle", siteTitle,
      "backend", backend,
      "database", database,
      "swaggerEnabled", swaggerEnabled,
      "swaggerProfiles", profiles
    );
  }
}
`;
}

function buildBackendTestJava() {
  return `package com.prooweb.generated;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
class ProowebApplicationTests {

  @Test
  void contextLoads() {
  }
}
`;
}

function buildBackendApplicationYaml(config) {
  const swaggerEnabled = config.backendOptions.swaggerUi.enabled;
  const swaggerProfiles = config.backendOptions.swaggerUi.profiles.join(",");

  return `server:
  port: 8080

spring:
  application:
    name: ${config.project.slug}-backend

management:
  endpoints:
    web:
      exposure:
        include: health,info

springdoc:
  api-docs:
    enabled: false
  swagger-ui:
    enabled: false

app:
  site-title: "${escapeYamlDoubleQuotes(config.project.title)}"
  stack:
    backend: ${config.stack.backendTech}
    database: ${config.stack.databaseTech}
  backend:
    swagger-ui:
      enabled: ${swaggerEnabled}
      profiles: "${escapeYamlDoubleQuotes(swaggerProfiles)}"
`;
}

function buildBackendSwaggerProfileYaml() {
  return `springdoc:
  api-docs:
    enabled: true
    path: /v3/api-docs
  swagger-ui:
    enabled: true
    path: /swagger-ui.html
`;
}

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

function buildFrontendIndexHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ProOWeb Generated Frontend</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`;
}

function buildFrontendMainJsx() {
  return `import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./app.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
`;
}

function buildFrontendAppJsx(defaultTitle) {
  const serializedTitle = JSON.stringify(defaultTitle);

  return `import { useEffect, useMemo, useState } from "react";

const DEFAULT_TITLE = ${serializedTitle};

export default function App() {
  const [meta, setMeta] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const healthLabel = useMemo(() => {
    if (!health) {
      return "unknown";
    }
    return health.status || "unknown";
  }, [health]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      try {
        const [metaResponse, healthResponse] = await Promise.all([
          fetch("/api/meta"),
          fetch("/actuator/health"),
        ]);

        if (!metaResponse.ok) {
          throw new Error("Failed to load /api/meta");
        }

        if (!healthResponse.ok) {
          throw new Error("Failed to load /actuator/health");
        }

        const [metaData, healthData] = await Promise.all([
          metaResponse.json(),
          healthResponse.json(),
        ]);

        setMeta(metaData);
        setHealth(healthData);
      } catch (cause) {
        setError(cause.message || "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  return (
    <main className="app-shell">
      <section className="card">
        <p className="eyebrow">ProOWeb generated project</p>
        <h1>{meta?.siteTitle || DEFAULT_TITLE}</h1>
        <p>
          Backend: <strong>{meta?.backend || "springboot"}</strong> | Database: <strong>{meta?.database || "postgresql"}</strong>
        </p>

        {meta?.swaggerEnabled ? (
          <p>
            Swagger UI active sur profils: <strong>{(meta.swaggerProfiles || []).join(", ") || "-"}</strong>
          </p>
        ) : (
          <p>Swagger UI desactive.</p>
        )}

        {loading ? <p>Loading backend status...</p> : null}
        {error ? <p className="error">{error}</p> : null}

        {!loading && !error ? (
          <p>
            Healthcheck: <span className={healthLabel === "UP" ? "ok" : "warn"}>{healthLabel}</span>
          </p>
        ) : null}
      </section>
    </main>
  );
}
`;
}

function buildFrontendCss() {
  return `:root {
  color-scheme: light;
  font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
  background: radial-gradient(circle at top right, #e9f4ff 0%, #f7fbff 42%, #ffffff 100%);
  color: #123;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
}

.app-shell {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 2rem;
}

.card {
  width: min(720px, 100%);
  background: #ffffff;
  border: 1px solid #cddceb;
  border-radius: 16px;
  padding: 2rem;
  box-shadow: 0 20px 45px rgba(13, 44, 77, 0.08);
}

.eyebrow {
  margin: 0;
  text-transform: uppercase;
  font-size: 0.78rem;
  letter-spacing: 0.12em;
  color: #355676;
}

h1 {
  margin: 0.75rem 0;
  font-size: clamp(1.8rem, 4vw, 2.6rem);
}

.ok {
  color: #0a7c2a;
  font-weight: 700;
}

.warn {
  color: #8c4c00;
  font-weight: 700;
}

.error {
  color: #b42318;
  font-weight: 600;
}
`;
}

function buildFrontendViteConfig() {
  return `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
      "/actuator": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
});
`;
}

function buildComposeFile(config, profile, ports) {
  return `services:
  db:
    image: postgres:16-alpine
    container_name: ${config.project.slug}-db-${profile}
    environment:
      POSTGRES_DB: prooweb
      POSTGRES_USER: prooweb
      POSTGRES_PASSWORD: prooweb
    ports:
      - "${ports.database}:5432"
    volumes:
      - db-data-${profile}:/var/lib/postgresql/data

  backend:
    build:
      context: ../..
      dockerfile: deployment/docker/backend.Dockerfile
    container_name: ${config.project.slug}-backend-${profile}
    depends_on:
      - db
    environment:
      SPRING_PROFILES_ACTIVE: ${profile}
      APP_SITE_TITLE: "${escapeYamlDoubleQuotes(config.project.title)}"
      SPRING_DATASOURCE_URL: jdbc:postgresql://db:5432/prooweb
      SPRING_DATASOURCE_USERNAME: prooweb
      SPRING_DATASOURCE_PASSWORD: prooweb
    ports:
      - "${ports.backend}:8080"

  frontend:
    build:
      context: ../..
      dockerfile: deployment/docker/frontend.Dockerfile
    container_name: ${config.project.slug}-frontend-${profile}
    depends_on:
      - backend
    ports:
      - "${ports.frontend}:80"

volumes:
  db-data-${profile}:
`;
}

function buildBackendDockerfile() {
  return `FROM maven:3.9.9-eclipse-temurin-21 AS build
WORKDIR /workspace
COPY src/backend/springboot ./src/backend/springboot
WORKDIR /workspace/src/backend/springboot
RUN mvn -q -DskipTests clean package

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /workspace/src/backend/springboot/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
`;
}

function buildFrontendDockerfile() {
  return `FROM node:20-alpine AS build
WORKDIR /workspace
COPY src/frontend/web/react ./src/frontend/web/react
WORKDIR /workspace/src/frontend/web/react
RUN npm install
RUN npm run build

FROM nginx:1.27-alpine
COPY deployment/docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/src/frontend/web/react/dist /usr/share/nginx/html
EXPOSE 80
`;
}

function buildNginxConf() {
  return `server {
  listen 80;
  server_name _;

  root /usr/share/nginx/html;
  index index.html;

  location /api/ {
    proxy_pass http://backend:8080/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }

  location /actuator/ {
    proxy_pass http://backend:8080/actuator/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }

  location / {
    try_files $uri /index.html;
  }
}
`;
}

function buildBuildAllPs1() {
  return `$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

function Assert-CommandExists([string]$name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "Commande requise non trouvee: $name"
  }
}

Push-Location $root
try {
  if (-not (Test-Path "src/backend/springboot/pom.xml")) {
    throw "Backend Spring Boot introuvable. Regenerer le workspace via ProOWeb."
  }

  if (-not (Test-Path "src/frontend/web/react/package.json")) {
    throw "Frontend React introuvable. Regenerer le workspace via ProOWeb."
  }

  Assert-CommandExists "mvn"
  Assert-CommandExists "npm"

  Push-Location "src/backend/springboot"
  mvn clean package -DskipTests
  Pop-Location

  Push-Location "src/frontend/web/react"
  npm install
  npm run build
  Pop-Location

  Write-Host "Build termine avec succes." -ForegroundColor Green
}
finally {
  Pop-Location
}
`;
}

function buildTestAllPs1() {
  return `$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

function Assert-CommandExists([string]$name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "Commande requise non trouvee: $name"
  }
}

Push-Location $root
try {
  Assert-CommandExists "mvn"
  Assert-CommandExists "npm"

  Push-Location "src/backend/springboot"
  mvn test
  Pop-Location

  Push-Location "src/frontend/web/react"
  npm run test --if-present
  Pop-Location

  Write-Host "Tests termines." -ForegroundColor Green
}
finally {
  Pop-Location
}
`;
}

function buildStartProfilePs1() {
  return `param(
  [string]$Profile = "dev"
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker est requis pour lancer les profils de deploiement."
}

$composeFile = Join-Path $root "deployment/docker/docker-compose.$Profile.yml"
if (-not (Test-Path $composeFile)) {
  throw "Profil inconnu: $Profile. Fichier attendu: $composeFile"
}

Push-Location $root
try {
  docker compose -f $composeFile up --build
}
finally {
  Pop-Location
}
`;
}

function buildBuildAllSh() {
  return `#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"

cd "$ROOT_DIR"

if ! command -v mvn >/dev/null 2>&1; then
  echo "mvn est requis" >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm est requis" >&2
  exit 1
fi

cd "$ROOT_DIR/src/backend/springboot"
mvn clean package -DskipTests

cd "$ROOT_DIR/src/frontend/web/react"
npm install
npm run build

echo "Build termine avec succes."
`;
}

function buildTestAllSh() {
  return `#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"

cd "$ROOT_DIR"

if ! command -v mvn >/dev/null 2>&1; then
  echo "mvn est requis" >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm est requis" >&2
  exit 1
fi

cd "$ROOT_DIR/src/backend/springboot"
mvn test

cd "$ROOT_DIR/src/frontend/web/react"
npm run test --if-present

echo "Tests termines."
`;
}

function buildStartProfileSh() {
  return `#!/usr/bin/env bash
set -euo pipefail

PROFILE="\${1:-dev}"
ROOT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$ROOT_DIR/deployment/docker/docker-compose.$PROFILE.yml"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker est requis" >&2
  exit 1
fi

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "Profil inconnu: $PROFILE" >&2
  exit 1
fi

cd "$ROOT_DIR"
docker compose -f "$COMPOSE_FILE" up --build
`;
}

function resolveProjectRoot(rootDir, generatedRoot) {
  const normalized = String(generatedRoot || "").trim() || "root";
  return normalized === "root" ? path.resolve(rootDir) : path.join(rootDir, normalized);
}

function buildWorkspaceReadme(config, generatedRoot) {
  const displayedRoot = generatedRoot === "root" ? "." : generatedRoot;

  return `# Generated Workspace

This workspace was generated and managed by ProOWeb.

## Project
- Title: ${config.project.title}
- Slug: ${config.project.slug}
- Generated root: ${displayedRoot}

## Stack
- Backend: ${config.stack.backendTech}
- Frontend (web): ${config.stack.frontendWebTech}
- Frontend (mobile): ${config.stack.frontendMobileTech}
- Database: ${config.stack.databaseTech}

## Backend options
- Swagger UI: ${config.backendOptions.swaggerUi.enabled ? "enabled" : "disabled"}
- Swagger profiles: ${config.backendOptions.swaggerUi.profiles.join(", ") || "none"}

## Workspace helper scripts (inside ${displayedRoot})
- Windows: build-all.ps1, test-all.ps1, start-profile.ps1
- Linux: build-all.sh, test-all.sh, start-profile.sh

## NPM shortcuts (from repository root)
- npm run compile
- npm test
- npm run start:dev
- npm run start:demo
- npm run start:test
- npm run start:preprod
- npm run start:prod
`;
}
function buildManagedManifest(config, generatedRoot, managedFiles, mode) {
  return `${JSON.stringify(
    {
      schemaVersion: 1,
      managedProjectVersion: config.managedBy.managedProjectVersion,
      layoutVersion: config.managedBy.layoutVersion,
      editorVersion: config.managedBy.editorVersion,
      generatedRoot,
      generatedAt: new Date().toISOString(),
      lastMigrationAt: config.managedBy.lastMigratedAt,
      mode,
      managedFiles,
    },
    null,
    2,
  )}\n`;
}

function generateApplicationScaffold(projectRoot, config, writeManagedFile) {
  const backendRoot = path.join(projectRoot, "src/backend/springboot");
  const frontendRoot = path.join(projectRoot, "src/frontend/web/react");
  const mobileRoot = path.join(projectRoot, "src/frontend/mobile");

  const swaggerEnabled = config.backendOptions.swaggerUi.enabled;

  writeManagedFile(
    path.join(backendRoot, "pom.xml"),
    buildBackendPomXml(config.project.title, config.project.slug, swaggerEnabled),
  );
  writeManagedFile(
    path.join(backendRoot, "src/main/java/com/prooweb/generated/ProowebApplication.java"),
    buildBackendApplicationJava(),
  );
  writeManagedFile(
    path.join(backendRoot, "src/main/java/com/prooweb/generated/config/WebCorsConfig.java"),
    buildBackendCorsConfigJava(),
  );
  writeManagedFile(
    path.join(backendRoot, "src/main/java/com/prooweb/generated/api/WorkspaceMetaController.java"),
    buildWorkspaceMetaControllerJava(),
  );
  writeManagedFile(path.join(backendRoot, "src/main/resources/application.yml"), buildBackendApplicationYaml(config));

  for (const swaggerProfile of config.backendOptions.swaggerUi.profiles) {
    writeManagedFile(
      path.join(backendRoot, `src/main/resources/application-${swaggerProfile}.yml`),
      buildBackendSwaggerProfileYaml(),
    );
  }

  writeManagedFile(
    path.join(backendRoot, "src/test/java/com/prooweb/generated/ProowebApplicationTests.java"),
    buildBackendTestJava(),
  );

  writeManagedFile(path.join(frontendRoot, "package.json"), buildFrontendPackageJson(config.project.slug));
  writeManagedFile(path.join(frontendRoot, "index.html"), buildFrontendIndexHtml());
  writeManagedFile(path.join(frontendRoot, "src/main.jsx"), buildFrontendMainJsx());
  writeManagedFile(path.join(frontendRoot, "src/App.jsx"), buildFrontendAppJsx(config.project.title));
  writeManagedFile(path.join(frontendRoot, "src/app.css"), buildFrontendCss());
  writeManagedFile(path.join(frontendRoot, "vite.config.js"), buildFrontendViteConfig());

  writeManagedFile(
    path.join(mobileRoot, "README.md"),
    "Mobile frontend generation is not enabled yet in this ProOWeb MVP.\n",
  );
}

function generateInfrastructure(projectRoot, config, generatedRoot, writeManagedFile) {
  const dockerRoot = path.join(projectRoot, "deployment/docker");

  writeManagedFile(path.join(dockerRoot, "backend.Dockerfile"), buildBackendDockerfile());
  writeManagedFile(path.join(dockerRoot, "frontend.Dockerfile"), buildFrontendDockerfile());
  writeManagedFile(path.join(dockerRoot, "nginx.conf"), buildNginxConf());

  for (const [profile, ports] of Object.entries(PROFILE_PORTS)) {
    writeManagedFile(
      path.join(dockerRoot, `docker-compose.${profile}.yml`),
      buildComposeFile(config, profile, ports),
    );
  }

  const buildPs1 = path.join(projectRoot, "build-all.ps1");
  const testPs1 = path.join(projectRoot, "test-all.ps1");
  const startPs1 = path.join(projectRoot, "start-profile.ps1");

  const buildSh = path.join(projectRoot, "build-all.sh");
  const testSh = path.join(projectRoot, "test-all.sh");
  const startSh = path.join(projectRoot, "start-profile.sh");

  writeManagedFile(buildPs1, buildBuildAllPs1());
  writeManagedFile(testPs1, buildTestAllPs1());
  writeManagedFile(startPs1, buildStartProfilePs1());

  writeManagedFile(buildSh, buildBuildAllSh());
  writeManagedFile(testSh, buildTestAllSh());
  writeManagedFile(startSh, buildStartProfileSh());

  ensureExecutable(buildSh);
  ensureExecutable(testSh);
  ensureExecutable(startSh);

  writeManagedFile(path.join(projectRoot, "GENERATED_WORKSPACE.md"), buildWorkspaceReadme(config, generatedRoot));
}

function generateWorkspace(rootDir, config, options = {}) {
  const mode = options.mode === "infra" ? "infra" : "full";
  const generatedRoot = config.managedBy?.generatedRoot || "root";
  const projectRoot = resolveProjectRoot(rootDir, generatedRoot);
  const managedFiles = [];
  const writeManagedFile = makeWriter(rootDir, managedFiles);

  fs.mkdirSync(projectRoot, { recursive: true });

  if (mode === "full") {
    generateApplicationScaffold(projectRoot, config, writeManagedFile);
  }

  generateInfrastructure(projectRoot, config, generatedRoot, writeManagedFile);

  writeManagedFile(
    path.join(projectRoot, ".prooweb-managed.json"),
    buildManagedManifest(config, generatedRoot, managedFiles, mode),
  );

  return {
    generatedRoot,
    mode,
    writtenFiles: managedFiles,
  };
}

module.exports = {
  generateWorkspace,
};


