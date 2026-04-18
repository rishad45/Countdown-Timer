import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "react-query";
import {
  Page,
  Layout,
  Card,
  InlineGrid,
  InlineStack,
  Text,
  Spinner,
  Button,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { useAuthenticatedFetch } from "../../hooks/useAuthenticatedFetch";

function formatUtcDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toISOString().slice(0, 10);
}

function formatUtcTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toISOString().slice(11, 16);
}

function formatScope(scopeType) {
  const map = {
    ALL_PRODUCTS: "All products",
    SELECTED_PRODUCTS: "Selected products",
    SELECTED_COLLECTIONS: "Selected collections",
  };
  return map[scopeType] || scopeType;
}

export default function TimerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const app = useAppBridge();
  const fetch = useAuthenticatedFetch();

  const { data: timer, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["timer", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const response = await fetch(`/api/timers/${encodeURIComponent(id)}`);
      const body = await response.json();
      if (response.status === 404) {
        throw new Error(body.errors?.join(" ") || "Timer not found.");
      }
      if (!response.ok) {
        throw new Error(body.errors?.join(" ") || "Failed to load timer.");
      }
      return body.timer;
    },
    onError: (err) => {
      app.toast.show(err.message || "Failed to load timer", { isError: true });
    },
  });

  const targetSummary = useMemo(() => {
    if (!timer) return "—";
    if (timer.scopeType === "ALL_PRODUCTS") return "All products";
    if (timer.scopeType === "SELECTED_PRODUCTS") {
      const n = timer.productIds?.length ?? 0;
      return `${n} product(s)`;
    }
    if (timer.scopeType === "SELECTED_COLLECTIONS") {
      const n = timer.collectionIds?.length ?? 0;
      return `${n} collection(s)`;
    }
    return timer.scopeType;
  }, [timer]);

  return (
    <Page
      title={timer?.label || "Timer"}
      backAction={{ content: "Timers", onAction: () => navigate("/timer") }}
    >
      <TitleBar title={timer?.label || "Timer"} />
      <Layout>
        <Layout.Section>
          <Card>
            {isLoading ? (
              <div style={{ padding: "24px", textAlign: "center" }}>
                <Spinner accessibilityLabel="Loading timer" size="large" />
              </div>
            ) : isError ? (
              <div style={{ padding: "16px" }}>
                <Text as="p" tone="critical">
                  {error?.message || "Could not load this timer."}
                </Text>
                <div style={{ marginTop: "12px" }}>
                  <InlineStack gap="200">
                    <Button onClick={() => refetch()}>Try again</Button>
                    <Button onClick={() => navigate("/timer")}>Back to timers</Button>
                  </InlineStack>
                </div>
              </div>
            ) : (
              <InlineGrid columns={1} gap="300">
                <div>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Status
                  </Text>
                  <Text as="p" variant="bodyMd">
                    {timer.status}
                  </Text>
                </div>
                <div>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Applies to
                  </Text>
                  <Text as="p" variant="bodyMd">
                    {formatScope(timer.scopeType)} — {targetSummary}
                  </Text>
                </div>
                <div>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Start (UTC)
                  </Text>
                  <Text as="p" variant="bodyMd">
                    {formatUtcDate(timer.startAtUtc)} {formatUtcTime(timer.startAtUtc)}
                  </Text>
                </div>
                <div>
                  <Text as="p" variant="bodySm" tone="subdued">
                    End (UTC)
                  </Text>
                  <Text as="p" variant="bodyMd">
                    {formatUtcDate(timer.endAtUtc)} {formatUtcTime(timer.endAtUtc)}
                  </Text>
                </div>
              </InlineGrid>
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
