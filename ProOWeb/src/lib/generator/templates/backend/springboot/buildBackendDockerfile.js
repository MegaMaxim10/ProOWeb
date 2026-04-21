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

module.exports = {
  buildBackendDockerfile,
};
