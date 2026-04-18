import { Page, CalloutCard, BlockStack } from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useNavigate } from "react-router-dom";

import homeHero from "../assets/home-hero.png";

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <Page
      narrowWidth
      title="Countdown Timer"
      subtitle="Storefront countdowns and performance in one place."
    >
      <TitleBar title="Countdown Timer" />
      <BlockStack gap="400">
        <CalloutCard
          title="Manage timers and reach"
          illustration={homeHero}
          primaryAction={{
            content: "Go to timers",
            onAction: () => navigate("/timer"),
            variant: "primary",
          }}
          secondaryAction={{
            content: "Analytics",
            onAction: () => navigate("/analytics"),
          }}
        >
          Create fixed-window or evergreen countdowns, target products or collections, then review impressions and add to cart from Analytics.
        </CalloutCard>
      </BlockStack>
    </Page>
  );
}
