const { escapeYamlDoubleQuotes } = require("../../_shared/escape");

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

module.exports = {
  buildComposeFile,
};
