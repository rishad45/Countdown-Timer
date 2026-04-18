import { useMemo, useState } from "react";
import {
  Page,
  Layout,
  Card,
  IndexTable,
  useIndexResourceState,
  EmptyState,
  Spinner,
  Text,
  Button
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "react-query";
import { DeleteIcon } from "@shopify/polaris-icons";
import { useAuthenticatedFetch } from "../../hooks/useAuthenticatedFetch";

function formatUtcDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toISOString().slice(0, 10);
}

function formatUtcTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toISOString().slice(11, 16);
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

export default function TimerListPage() {
  const navigate = useNavigate();
  const app = useAppBridge();
  const fetch = useAuthenticatedFetch();
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState(false);

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

  const items = useMemo(
    () =>
      timers.map((timer) => ({
        id: timer.id,
        label: timer.label,
        type: formatTimerType(timer.timerType),
        startDate: formatUtcDate(timer.startAtUtc),
        startTime: formatUtcTime(timer.startAtUtc),
        endDate: formatUtcDate(timer.endAtUtc),
        endTime: formatUtcTime(timer.endAtUtc),
        evergreenDuration: formatEvergreenDuration(timer.evergreenDurationSeconds),
        status: timer.status,
      })),
    [timers]
  );

  const resourceName = {
    singular: "timer",
    plural: "timers",
  };

  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(items);

  const handleBulkDelete = async () => {
    if (selectedResources.length === 0 || deleting) return;

    try {
      setDeleting(true);
      const response = await fetch("/api/timers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedResources }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.errors?.join(" ") || "Failed to delete timers.");
      }

      const deletedCount = Number(body?.deletedCount) || 0;
      app.toast.show(deletedCount > 0 ? `${deletedCount} timer(s) deleted.` : "No timers deleted.");
      await queryClient.invalidateQueries(["timers"]);
    } catch (err) {
      app.toast.show(err.message || "Failed to delete timers.", { isError: true });
    } finally {
      setDeleting(false);
    }
  };

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
              <IndexTable
                resourceName={resourceName}
                itemCount={items.length}
                selectedItemsCount={allResourcesSelected ? "All" : selectedResources.length}
                onSelectionChange={handleSelectionChange}
                promotedBulkActions={[
                  {
                    content: "Delete",
                    icon: DeleteIcon,
                    destructive: true,
                    onAction: handleBulkDelete,
                    loading: deleting,
                  },
                ]}
                loading={deleting}
                headings={[
                  { title: "Label" },
                  { title: "Type" },
                  { title: "Start date (UTC)" },
                  { title: "Start time (UTC)" },
                  { title: "End date (UTC)" },
                  { title: "End time (UTC)" },
                  { title: "Evergreen duration" },
                  { title: "Status" },
                ]}
              >
                {items.map((item, index) => (
                  <IndexTable.Row
                    id={item.id}
                    key={item.id}
                    position={index}
                    selected={selectedResources.includes(item.id)}
                  >
                    <IndexTable.Cell>
                      <RouterLink
                        to={`/timer/${item.id}`}
                        style={{
                          color: "var(--p-color-text)",
                          textDecoration: "none",
                          fontWeight: 600,
                        }}
                      >
                        {item.label}
                      </RouterLink>
                    </IndexTable.Cell>
                    <IndexTable.Cell>{item.type}</IndexTable.Cell>
                    <IndexTable.Cell>{item.startDate}</IndexTable.Cell>
                    <IndexTable.Cell>{item.startTime}</IndexTable.Cell>
                    <IndexTable.Cell>{item.endDate}</IndexTable.Cell>
                    <IndexTable.Cell>{item.endTime}</IndexTable.Cell>
                    <IndexTable.Cell>{item.evergreenDuration}</IndexTable.Cell>
                    <IndexTable.Cell>{item.status}</IndexTable.Cell>
                  </IndexTable.Row>
                ))}
              </IndexTable>
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
