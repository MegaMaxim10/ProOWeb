function buildBackendProcessRuntimeBddStepsJava({ basePackage }) {
  return `package ${basePackage}.tests.system.steps;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

public class ProcessRuntimeBddSteps {
  @Autowired
  private MockMvc mockMvc;

  @Autowired
  private ObjectMapper objectMapper;

  private String actor = "runtime.user";
  private String rolesCsv = "PROCESS_USER";
  private MvcResult lastResult;
  private String deployedModelKey = "";
  private int deployedVersionNumber = 0;
  private String deployedInstanceId = "";
  private JsonNode deployedInstanceNode;
  private JsonNode deployedTimelineNode;

  @Given("runtime actor {string} and roles {string}")
  public void runtimeActorAndRoles(String actorId, String roleCodesCsv) {
    actor = actorId;
    rolesCsv = roleCodesCsv;
  }

  @When("I request system health")
  public void requestSystemHealth() throws Exception {
    lastResult = mockMvc.perform(
      get("/api/system-health")
        .with(user(actor).authorities(toAuthorities(rolesCsv)))
    )
      .andReturn();
  }

  @When("I request system metadata")
  public void requestSystemMetadata() throws Exception {
    lastResult = mockMvc.perform(
      get("/api/meta")
        .with(user(actor).authorities(toAuthorities(rolesCsv)))
    )
      .andReturn();
  }

  @Given("deployed process {string} version {int} with actor {string} and roles {string}")
  public void deployedProcessContext(String modelKey, int versionNumber, String actorId, String roleCodesCsv) {
    deployedModelKey = modelKey;
    deployedVersionNumber = versionNumber;
    actor = actorId;
    rolesCsv = roleCodesCsv;
    deployedInstanceId = "";
    deployedInstanceNode = null;
    deployedTimelineNode = null;
  }

  @When("I start the deployed process instance")
  public void startDeployedProcessInstance() throws Exception {
    String roleArrayJson = toRoleArrayJson(rolesCsv);
    lastResult = mockMvc.perform(
      post("/api/process-runtime/instances/start")
        .with(user(actor).authorities(toAuthorities(rolesCsv)))
        .contentType(MediaType.APPLICATION_JSON)
        .content(
          """
            {
              "modelKey": "__MODEL_KEY__",
              "versionNumber": __VERSION__,
              "actor": "__ACTOR__",
              "roleCodes": __ROLES__,
              "initialPayload": {
                "seed": "bdd-generated"
              }
            }
            """
            .replace("__MODEL_KEY__", escapeJson(deployedModelKey))
            .replace("__VERSION__", String.valueOf(deployedVersionNumber))
            .replace("__ACTOR__", escapeJson(actor))
            .replace("__ROLES__", roleArrayJson)
        )
    ).andReturn();

    JsonNode root = objectMapper.readTree(lastResult.getResponse().getContentAsString());
    deployedInstanceNode = root.path("instance");
    deployedInstanceId = deployedInstanceNode.path("instanceId").asText("");
  }

  @Then("the deployed process instance is created")
  public void deployedProcessInstanceIsCreated() {
    assertThat(lastResult).isNotNull();
    assertThat(lastResult.getResponse().getStatus()).isEqualTo(200);
    assertThat(deployedInstanceId).isNotBlank();
  }

  @When("I drive the deployed process instance to completion as monitor")
  public void driveDeployedProcessInstanceToCompletion() throws Exception {
    assertThat(deployedInstanceId).isNotBlank();

    for (int guard = 0; guard < 200; guard += 1) {
      JsonNode runtimeInstance = readRuntimeInstanceAsMonitor();
      String status = runtimeInstance.path("status").asText("");
      if ("COMPLETED".equalsIgnoreCase(status) || "STOPPED".equalsIgnoreCase(status) || "ARCHIVED".equalsIgnoreCase(status)) {
        deployedInstanceNode = runtimeInstance;
        deployedTimelineNode = readTimelineNode();
        return;
      }

      JsonNode taskRows = listTasksAsMonitor();
      boolean completedAtLeastOneTask = false;
      for (JsonNode task : taskRows) {
        String instanceId = task.path("instanceId").asText("");
        if (!deployedInstanceId.equals(instanceId)) {
          continue;
        }

        String taskId = task.path("taskId").asText("");
        if (taskId.isBlank()) {
          continue;
        }

        String assignee = task.path("assignee").asText("");
        if (assignee.isBlank()) {
          forceAssignTaskAsMonitor(taskId);
        }

        completeTaskAsMonitor(taskId);
        completedAtLeastOneTask = true;
      }

      if (!completedAtLeastOneTask) {
        break;
      }
    }

    deployedInstanceNode = readRuntimeInstanceAsMonitor();
    deployedTimelineNode = readTimelineNode();
  }

  @Then("the deployed process instance reaches terminal status {string}")
  public void deployedProcessInstanceReachesTerminalStatus(String expectedStatus) throws Exception {
    JsonNode runtimeInstance = deployedInstanceNode == null ? readRuntimeInstanceAsMonitor() : deployedInstanceNode;
    String status = runtimeInstance.path("status").asText("");
    assertThat(status).isEqualTo(expectedStatus);
  }

  @Then("the deployed process timeline contains activity {string}")
  public void deployedTimelineContainsActivity(String activityId) throws Exception {
    JsonNode timelineNode = deployedTimelineNode == null ? readTimelineNode() : deployedTimelineNode;
    assertThat(timelineNode.isArray()).isTrue();
    boolean found = false;
    for (JsonNode entry : timelineNode) {
      String text = entry.asText("");
      if (text.contains(":" + activityId + ":")
        || text.endsWith(":" + activityId)
        || text.equals(activityId)) {
        found = true;
        break;
      }
    }
    assertThat(found)
      .as("Expected activity '%s' in timeline", activityId)
      .isTrue();
  }

  @Then("the deployed process timeline contains marker {string}")
  public void deployedTimelineContainsMarker(String marker) throws Exception {
    JsonNode timelineNode = deployedTimelineNode == null ? readTimelineNode() : deployedTimelineNode;
    assertThat(timelineNode.isArray()).isTrue();
    boolean found = false;
    for (JsonNode entry : timelineNode) {
      if (entry.asText("").contains(marker)) {
        found = true;
        break;
      }
    }
    assertThat(found)
      .as("Expected marker '%s' in timeline", marker)
      .isTrue();
  }

  @When("I query runtime start options")
  public void queryRuntimeStartOptions() throws Exception {
    lastResult = mockMvc.perform(
      get("/api/process-runtime/start-options")
        .with(user(actor).authorities(toAuthorities(rolesCsv)))
        .queryParam("actor", actor)
        .queryParam("roles", rolesCsv))
      .andReturn();
  }

  @Then("the HTTP response status is {int}")
  public void responseStatusIs(int status) {
    assertThat(lastResult).isNotNull();
    assertThat(lastResult.getResponse().getStatus()).isEqualTo(status);
  }

  @Then("the response contains field {string}")
  public void responseContainsField(String fieldName) throws Exception {
    JsonNode root = objectMapper.readTree(lastResult.getResponse().getContentAsString());
    assertThat(root.has(fieldName)).isTrue();
  }

  @Then("runtime start options payload is readable")
  public void runtimeStartOptionsPayloadIsReadable() throws Exception {
    JsonNode root = objectMapper.readTree(lastResult.getResponse().getContentAsString());
    JsonNode startOptions = root.path("startOptions");
    assertThat(startOptions.isArray()).isTrue();
  }

  @Then("runtime start options include process {string} version {int}")
  public void runtimeStartOptionsIncludeProcessVersion(String modelKey, int versionNumber) throws Exception {
    JsonNode root = objectMapper.readTree(lastResult.getResponse().getContentAsString());
    JsonNode startOptions = root.path("startOptions");
    assertThat(startOptions.isArray()).isTrue();

    boolean found = false;
    for (JsonNode entry : startOptions) {
      String entryModelKey = entry.path("modelKey").asText("");
      int entryVersionNumber = entry.path("versionNumber").asInt(-1);
      if (modelKey.equals(entryModelKey) && versionNumber == entryVersionNumber) {
        found = true;
        break;
      }
    }

    assertThat(found)
      .as("Expected process '%s' v%s in runtime start options", modelKey, versionNumber)
      .isTrue();
  }

  private JsonNode readRuntimeInstanceAsMonitor() throws Exception {
    MvcResult result = mockMvc.perform(
      get("/api/process-runtime/instances/" + deployedInstanceId)
        .with(user("runtime.supervisor").authorities(toAuthorities("PROCESS_MONITOR")))
        .queryParam("actor", "runtime.supervisor")
        .queryParam("roles", "PROCESS_MONITOR")
    ).andReturn();
    assertThat(result.getResponse().getStatus()).isEqualTo(200);
    JsonNode payload = objectMapper.readTree(result.getResponse().getContentAsString());
    return payload.path("instance");
  }

  private JsonNode readTimelineNode() throws Exception {
    MvcResult result = mockMvc.perform(
      get("/api/process-runtime/instances/" + deployedInstanceId + "/timeline")
        .with(user("runtime.supervisor").authorities(toAuthorities("PROCESS_MONITOR")))
    ).andReturn();
    assertThat(result.getResponse().getStatus()).isEqualTo(200);
    JsonNode payload = objectMapper.readTree(result.getResponse().getContentAsString());
    return payload.path("timeline");
  }

  private JsonNode listTasksAsMonitor() throws Exception {
    MvcResult result = mockMvc.perform(
      get("/api/process-runtime/tasks")
        .with(user("runtime.supervisor").authorities(toAuthorities("PROCESS_MONITOR")))
        .queryParam("actor", "runtime.supervisor")
        .queryParam("roles", "PROCESS_MONITOR")
    ).andReturn();
    assertThat(result.getResponse().getStatus()).isEqualTo(200);
    JsonNode payload = objectMapper.readTree(result.getResponse().getContentAsString());
    return payload.path("tasks");
  }

  private void forceAssignTaskAsMonitor(String taskId) throws Exception {
    MvcResult result = mockMvc.perform(
      post("/api/process-runtime/tasks/" + taskId + "/assign")
        .with(user("runtime.supervisor").authorities(toAuthorities("PROCESS_MONITOR")))
        .contentType(MediaType.APPLICATION_JSON)
        .content(
          """
            {
              "instanceId": "__INSTANCE_ID__",
              "actor": "runtime.supervisor",
              "roleCodes": ["PROCESS_MONITOR"],
              "assignee": "runtime.user",
              "force": true
            }
            """.replace("__INSTANCE_ID__", escapeJson(deployedInstanceId))
        )
    ).andReturn();
    assertThat(result.getResponse().getStatus()).isEqualTo(200);
  }

  private void completeTaskAsMonitor(String taskId) throws Exception {
    MvcResult result = mockMvc.perform(
      post("/api/process-runtime/tasks/" + taskId + "/complete")
        .with(user("runtime.supervisor").authorities(toAuthorities("PROCESS_MONITOR")))
        .contentType(MediaType.APPLICATION_JSON)
        .content(
          """
            {
              "instanceId": "__INSTANCE_ID__",
              "actor": "runtime.supervisor",
              "roleCodes": ["PROCESS_MONITOR"],
              "payload": {
                "decision": "APPROVED",
                "approved": true
              }
            }
            """.replace("__INSTANCE_ID__", escapeJson(deployedInstanceId))
        )
    ).andReturn();
    assertThat(result.getResponse().getStatus()).isEqualTo(200);
  }

  private String toRoleArrayJson(String csv) {
    return "[" + Arrays.stream(String.valueOf(csv == null ? "" : csv).split(","))
      .map(String::trim)
      .filter((value) -> !value.isBlank())
      .map((value) -> "\\"" + escapeJson(value) + "\\"")
      .collect(Collectors.joining(",")) + "]";
  }

  private String escapeJson(String value) {
    return String.valueOf(value == null ? "" : value)
      .replace("\\\\", "\\\\\\\\")
      .replace("\\"", "\\\\\\"")
      .replace("\\r", "\\\\r")
      .replace("\\n", "\\\\n");
  }

  private List<GrantedAuthority> toAuthorities(String csv) {
    if (csv == null || csv.isBlank()) {
      return List.of(new SimpleGrantedAuthority("PROCESS_USER"));
    }
    return Arrays.stream(csv.split(","))
      .map(String::trim)
      .filter((value) -> !value.isBlank())
      .map(SimpleGrantedAuthority::new)
      .collect(Collectors.toList());
  }
}
`;
}

module.exports = {
  buildBackendProcessRuntimeBddStepsJava,
};
