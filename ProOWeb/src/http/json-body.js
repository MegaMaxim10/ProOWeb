function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let raw = "";

    request.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error("Payload too large"));
        request.destroy();
      }
    });

    request.on("end", () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch (_) {
        reject(new Error("Invalid JSON payload"));
      }
    });

    request.on("error", (error) => {
      reject(error);
    });
  });
}

module.exports = {
  readJsonBody,
};
