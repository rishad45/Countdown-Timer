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
  List,
  BlockStack,
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

function formatTimerType(timerType) {
  if (timerType === "EVERGREEN") return "Evergreen";
  return "Fixed window";
}

function formatEvergreenDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  const totalMinutes = Math.floor(seconds / 60);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);
  return parts.join(" ");
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

  const productRows = useMemo(() => {
    if (!timer || timer.scopeType !== "SELECTED_PRODUCTS") return [];
    const resolved = timer.resolvedProducts;
    if (Array.isArray(resolved) && resolved.length > 0) {
      return resolved.map((p) => ({
        id: String(p.id),
        label: typeof p.title === "string" && p.title.trim() ? p.title.trim() : null,
      }));
    }
    return (timer.productIds || []).map((id) => ({
      id: String(id),
      label: null,
    }));
  }, [timer]);

  const collectionRows = useMemo(() => {
    if (!timer || timer.scopeType !== "SELECTED_COLLECTIONS") return [];
    const resolved = timer.resolvedCollections;
    if (Array.isArray(resolved) && resolved.length > 0) {
      return resolved.map((c) => ({
        id: String(c.id),
        label: typeof c.title === "string" && c.title.trim() ? c.title.trim() : null,
      }));
    }
    return (timer.collectionIds || []).map((id) => ({
      id: String(id),
      label: null,
    }));
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
                    Type
                  </Text>
                  <Text as="p" variant="bodyMd">
                    {formatTimerType(timer.timerType)}
                  </Text>
                </div>
                <div>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Applies to
                  </Text>
                  <Text as="p" variant="bodyMd">
                    {formatScope(timer.scopeType)}
                  </Text>
                  {productRows.length > 0 ? (
                    <div style={{ marginTop: "8px" }}>
                      <BlockStack gap="100">
                        <Text as="p" variant="bodySm" tone="subdued">
                          Products
                        </Text>
                        <List type="bullet" gap="extraTight">
                          {productRows.map((row) => (
                            <List.Item key={row.id}>
                              {row.label ?? `Product ${row.id}`}
                            </List.Item>
                          ))}
                        </List>
                      </BlockStack>
                    </div>
                  ) : null}
                  {collectionRows.length > 0 ? (
                    <div style={{ marginTop: "8px" }}>
                      <BlockStack gap="100">
                        <Text as="p" variant="bodySm" tone="subdued">
                          Collections
                        </Text>
                        <List type="bullet" gap="extraTight">
                          {collectionRows.map((row) => (
                            <List.Item key={row.id}>
                              {row.label ?? `Collection ${row.id}`}
                            </List.Item>
                          ))}
                        </List>
                      </BlockStack>
                    </div>
                  ) : null}
                </div>
                {timer.timerType === "EVERGREEN" ? (
                  <div>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Duration
                    </Text>
                    <Text as="p" variant="bodyMd">
                      {formatEvergreenDuration(timer.evergreenDurationSeconds)}
                    </Text>
                  </div>
                ) : null}
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
