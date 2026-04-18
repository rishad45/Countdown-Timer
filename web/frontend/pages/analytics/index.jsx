import { useQuery } from "react-query";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  Button,
  Banner,
  Spinner,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { useAuthenticatedFetch } from "../../hooks/useAuthenticatedFetch";

function MetricCard({ title, value }) {
  return (
    <Card>
      <BlockStack gap="200">
        <Text variant="headingSm" tone="subdued" as="h3">
          {title}
        </Text>
        <Text variant="heading2xl" as="p">
          {value}
        </Text>
      </BlockStack>
    </Card>
  );
}

export default function AnalyticsPage() {
  const app = useAppBridge();
  const fetch = useAuthenticatedFetch();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["analyticsSummary"],
    queryFn: async () => {
      const response = await fetch("/api/analytics/summary");
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.errors?.join(" ") || "Failed to load analytics.");
      }
      return body;
    },
    onError: (err) => {
      app.toast.show(err.message || "Failed to load analytics", { isError: true });
    },
  });

  const impressions = data?.impressions ?? 0;
  const addToCart = data?.addToCart ?? 0;
  const conversionRate = data?.conversionRate ?? 0;

  return (
    <Page title="Timer analytics">
      <TitleBar title="Timer analytics" />
      <BlockStack gap="400">
        {isLoading ? (
          <Card>
            <div style={{ padding: "24px", textAlign: "center" }}>
              <Spinner accessibilityLabel="Loading analytics" size="large" />
            </div>
          </Card>
        ) : isError ? (
          <Banner tone="critical" title="Could not load analytics">
            <p>{error?.message || "Something went wrong."}</p>
            <div style={{ marginTop: "8px" }}>
              <Button onClick={() => refetch()}>Try again</Button>
            </div>
          </Banner>
        ) : (
          <Layout>
            <Layout.Section variant="oneThird">
              <MetricCard title="Impressions" value={impressions} />
            </Layout.Section>
            <Layout.Section variant="oneThird">
              <MetricCard title="Add to cart" value={addToCart} />
            </Layout.Section>
            <Layout.Section variant="oneThird">
              <MetricCard title="Conversion rate" value={`${conversionRate}%`} />
            </Layout.Section>
          </Layout>
        )}
      </BlockStack>
    </Page>
  );
}
