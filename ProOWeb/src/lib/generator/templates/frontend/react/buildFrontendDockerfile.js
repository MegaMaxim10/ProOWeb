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

module.exports = {
  buildFrontendDockerfile,
};
