import { useState } from "react";
import {
  Page,
  Layout,
  Card,
  InlineGrid,
  Text,
  FormLayout,
  TextField,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

export default function NewTimerPage() {
  const [label, setLabel] = useState("");
  const [startTime, setStartTime] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [endDate, setEndDate] = useState("");

  return (
    <Page>
      <TitleBar title="Create Timer" />
      <Layout>
        <Layout.Section variant="oneHalf">
          <InlineGrid columns={1} gap="400">
            <Card>
              <FormLayout>
                <TextField
                  label="Timer Label"
                  value={label}
                  onChange={setLabel}
                  autoComplete="off"
                />
              </FormLayout>
            </Card>

            <Card>
              <FormLayout>
                <TextField
                  label="Start Date"
                  type="date"
                  value={startDate}
                  onChange={setStartDate}
                  autoComplete="off"
                />
                <TextField
                  label="Start Time"
                  type="time"
                  value={startTime}
                  onChange={setStartTime}
                  autoComplete="off"
                />
                <TextField
                  label="End Date"
                  type="date"
                  value={endDate}
                  onChange={setEndDate}
                  autoComplete="off"
                />
                <TextField
                  label="End Time"
                  type="time"
                  value={endTime}
                  onChange={setEndTime}
                  autoComplete="off"
                />
              </FormLayout>
            </Card>
          </InlineGrid>
        </Layout.Section>

        <Layout.Section variant="oneHalf">
          <Card>
            <InlineGrid columns={1} gap="200">
              <Text as="h2" variant="headingMd">
                Timer Preview
              </Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                This area will show timer details and settings summary.
              </Text>
            </InlineGrid>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
