import {
  Card,
  Page,
  Layout,
  DataTable,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

export default function HomePage() {
  const rows = [
    ["Starter Plan", "8", "2", "Apr 17, 2026"],
    ["Holiday Bundle", "15", "6", "Apr 16, 2026"],
    ["Pro Toolkit", "27", "11", "Apr 15, 2026"],
    ["Sample Product", "12", "4", "Apr 14, 2026"],
  ];

  return (
    <Page narrowWidth>
      <TitleBar title="Products Overview" />
      <Layout>
        <Layout.Section>
          <Card>
            <DataTable
              columnContentTypes={["text", "numeric", "numeric", "text"]}
              headings={["Product", "Inventory", "Sales", "Updated"]}
              rows={rows}
            />
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
