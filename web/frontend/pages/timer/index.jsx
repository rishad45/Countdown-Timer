import { useMemo } from "react";
import {
  Page,
  Layout,
  Card,
  DataTable,
  EmptyState,
  Spinner,
  Text,
  Button,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "react-query";
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

export default function TimerListPage() {
  const navigate = useNavigate();
  const app = useAppBridge();
  const fetch = useAuthenticatedFetch();

  const { data: timers = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ["timers"],
    queryFn: async () => {
      const response = await fetch("/api/timers");
      const body = await response.json();
      if (!response.ok) {
        const message = body.errors?.join(" ") || "Failed to load timers";
        throw new Error(message);
      }
      return body.timers ?? [];
    },
    onError: (err) => {
      app.toast.show(err.message || "Failed to load timers", { isError: true });
    },
  });

  const rows = useMemo(
    () =>
      timers.map((timer) => [
        <Button
          key={timer.id}
          variant="plain"
          onClick={() => navigate(`/timer/${timer.id}`)}
        >
          {timer.label}
        </Button>,
        formatScope(timer.scopeType),
        formatUtcDate(timer.startAtUtc),
        formatUtcTime(timer.startAtUtc),
        formatUtcDate(timer.endAtUtc),
        formatUtcTime(timer.endAtUtc),
        timer.status,
      ]),
    [navigate, timers]
  );

  return (
    <Page
      title="Timers"
      primaryAction={{
        content: "Create Timer",
        onAction: () => navigate("/timer/new"),
      }}
    >
      <TitleBar title="Timers" />
      <Layout>
        <Layout.Section>
          <Card>
            {isLoading ? (
              <div style={{ padding: "24px", textAlign: "center" }}>
                <Spinner accessibilityLabel="Loading timers" size="large" />
              </div>
            ) : isError ? (
              <div style={{ padding: "16px" }}>
                <Text as="p" tone="critical">
                  {error?.message || "Could not load timers."}
                </Text>
                <div style={{ marginTop: "12px" }}>
                  <Button onClick={() => refetch()}>Try again</Button>
                </div>
              </div>
            ) : timers.length === 0 ? (
              <EmptyState
                heading="No timers yet"
                action={{
                  content: "Create timer",
                  onAction: () => navigate("/timer/new"),
                }}
              >
                <p>Create a countdown timer to show on your storefront.</p>
              </EmptyState>
            ) : (
              <DataTable
                columnContentTypes={[
                  "text",
                  "text",
                  "text",
                  "text",
                  "text",
                  "text",
                  "text",
                ]}
                headings={[
                  "Label",
                  "Scope",
                  "Start date (UTC)",
                  "Start time (UTC)",
                  "End date (UTC)",
                  "End time (UTC)",
                  "Status",
                ]}
                rows={rows}
              />
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
