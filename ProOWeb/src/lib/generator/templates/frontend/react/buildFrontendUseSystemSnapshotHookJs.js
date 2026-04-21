function buildFrontendUseSystemSnapshotHookJs() {
  return `import { useEffect, useMemo, useState } from "react";
import { createSystemSnapshot } from "../domain/model/SystemSnapshot";
import { createReadSystemSnapshotUseCase } from "../application/usecase/ReadSystemSnapshot";
import { createHttpSystemSnapshotAdapter } from "../infrastructure/adapter/out/http/HttpSystemSnapshotAdapter";

const readSystemSnapshot = createReadSystemSnapshotUseCase({
  loadSystemSnapshotPort: createHttpSystemSnapshotAdapter(),
});

export function useSystemSnapshot() {
  const [snapshot, setSnapshot] = useState(createSystemSnapshot);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const next = await readSystemSnapshot({ signal: controller.signal });
        setSnapshot(next);
      } catch (cause) {
        if (cause?.name !== "AbortError") {
          setError(cause?.message || "Unknown error");
        }
      } finally {
        setLoading(false);
      }
    }

    load();

    return () => {
      controller.abort();
    };
  }, []);

  const healthLabel = useMemo(() => {
    if (!snapshot?.health) {
      return "unknown";
    }
    return snapshot.health.status || "unknown";
  }, [snapshot]);

  return {
    snapshot,
    loading,
    error,
    healthLabel,
  };
}
`;
}

module.exports = {
  buildFrontendUseSystemSnapshotHookJs,
};
