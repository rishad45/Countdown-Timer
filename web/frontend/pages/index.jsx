import {
  Card,
  Page,
  Layout,
  Text,
  Button,
  BlockStack,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useNavigate } from "react-router-dom";

import homeHero from "../assets/home-hero.png";

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <Page fullWidth>
      <TitleBar title="Countdown Timer" />
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Welcome to Countdown Timer
              </Text>
              <Text as="p" tone="subdued">
                Create and manage your storefront timers from one place.
              </Text>
              <div>
                <Button variant="primary" onClick={() => navigate("/timer")}>
                  Go to timers
                </Button>
              </div>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
