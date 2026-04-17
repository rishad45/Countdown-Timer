import { Page, Layout, Card, DataTable } from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useNavigate } from "react-router-dom";

export default function TimerListPage() {
  const navigate = useNavigate();
  const rows = [
    ["1", "09:00", "2026-04-17", "18:00", "2026-04-17"],
    ["2", "08:30", "2026-04-18", "20:00", "2026-04-18"],
    ["3", "10:15", "2026-04-19", "19:30", "2026-04-19"],
  ];

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
            <DataTable
              columnContentTypes={["text", "text", "text", "text", "text"]}
              headings={["ID", "Start Time", "Start Date", "End Time", "End Date"]}
              rows={rows}
            />
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
