const fs = require("node:fs");
const path = require("node:path");

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
};

function createPublicFileHandler({ publicDir, sendText, fsModule = fs, pathModule = path }) {
  const resolvedPublicDir = pathModule.resolve(publicDir);

  function isPathInsidePublicDir(absolutePath) {
    const resolvedTarget = pathModule.resolve(absolutePath);

    return (
      resolvedTarget === resolvedPublicDir ||
      resolvedTarget.startsWith(`${resolvedPublicDir}${pathModule.sep}`)
    );
  }

  function sendFile(response, absoluteFilePath) {
    if (!isPathInsidePublicDir(absoluteFilePath)) {
      sendText(response, 403, "Forbidden");
      return;
    }

    fsModule.readFile(absoluteFilePath, (error, buffer) => {
      if (error) {
        if (error.code === "ENOENT") {
          sendText(response, 404, "Not found");
          return;
        }

        sendText(response, 500, "Unable to read file");
        return;
      }

      const extension = pathModule.extname(absoluteFilePath).toLowerCase();
      response.writeHead(200, {
        "Content-Type": CONTENT_TYPES[extension] || "application/octet-stream",
        "Content-Length": buffer.length,
        "Cache-Control": "no-store",
      });
      response.end(buffer);
    });
  }

  function resolvePublicPath(urlPathname) {
    let decodedPathname;
    try {
      decodedPathname = decodeURIComponent(urlPathname || "/");
    } catch (_) {
      decodedPathname = "/";
    }

    const cleaned = decodedPathname.replace(/^\/+/, "");
    const normalized = cleaned || "index.html";
    return pathModule.resolve(resolvedPublicDir, normalized);
  }

  return {
    sendFile,
    resolvePublicPath,
    resolvedPublicDir,
  };
}

module.exports = {
  createPublicFileHandler,
};
