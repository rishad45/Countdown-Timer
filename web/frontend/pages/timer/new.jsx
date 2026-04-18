import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Page,
  Layout,
  Card,
  Text,
  FormLayout,
  TextField,
  Select,
  Button,
  BlockStack,
  Banner,
  InlineStack,
} from "@shopify/polaris";
import { SaveBar, TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { useQueryClient } from "react-query";
import { useAuthenticatedFetch } from "../../hooks/useAuthenticatedFetch";

export default function NewTimerPage() {
  const app = useAppBridge();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetch = useAuthenticatedFetch();
  const [isSaving, setIsSaving] = useState(false);
  const [savedForm, setSavedForm] = useState({
    label: "",
    timerType: "FIXED_WINDOW",
    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
    evergreenDays: "0",
    evergreenHours: "1",
    evergreenMinutes: "0",
    applyTo: "ALL_PRODUCTS",
    selectedProducts: [],
    selectedCollections: [],
  });
  const [form, setForm] = useState(savedForm);

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(savedForm),
    [form, savedForm]
  );

  useEffect(() => {
    if (isDirty) {
      app.saveBar.show("timer-save-bar");
      return;
    }
    app.saveBar.hide("timer-save-bar");
  }, [app, isDirty]);

  useEffect(() => {
    return () => {
      app.saveBar.hide("timer-save-bar");
    };
  }, [app]);

  const handleSave = async () => {
    if (isSaving) return;

    setIsSaving(true);
    app.loading(true);

    try {
      const response = await fetch("/api/timers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json();

      if (!response.ok) {
        if (payload?.reauthenticate) {
          app.toast.show("Session expired. Please re-authenticate manually.", {
            isError: true,
          });
          return;
        }

        const errorText =
          payload?.errors?.join(" ") || "Unable to save timer. Please try again.";
        app.toast.show(errorText, { isError: true });
        return;
      }

      setSavedForm(form);
      app.toast.show("Timer created successfully.");
      app.saveBar.hide("timer-save-bar");
      await queryClient.invalidateQueries(["timers"]);
      const newId = payload.timerId;
      if (newId) {
        navigate(`/timer/${newId}`);
        return;
      }
      navigate("/timer");
    } catch (_error) {
      app.toast.show("Unable to save timer. Please try again.", { isError: true });
    } finally {
      app.loading(false);
      setIsSaving(false);
    }
  };

  const handleDiscard = () => {
    setForm(savedForm);
    app.toast.show("Changes discarded.");
  };

  const handleApplyToChange = (value) => {
    setForm((currentForm) => ({
      ...currentForm,
      applyTo: value,
      selectedProducts: value === "SELECTED_PRODUCTS" ? currentForm.selectedProducts : [],
      selectedCollections:
        value === "SELECTED_COLLECTIONS" ? currentForm.selectedCollections : [],
    }));
  };

  const handleTimerTypeChange = (value) => {
    setForm((currentForm) => ({
      ...currentForm,
      timerType: value,
    }));
  };

  const openProductPicker = async () => {
    const selection = await app.resourcePicker({
      type: "product",
      multiple: true,
      filter: {
        variants: false,
      },
      selectionIds: form.selectedProducts.map((item) => ({ id: item.id })),
    });

    if (!selection || selection.length === 0) return;

    setForm((currentForm) => ({
      ...currentForm,
      selectedProducts: selection.map((item) => ({
        id: item.id,
        title: item.title,
      })),
    }));
  };

  const openCollectionPicker = async () => {
    const selection = await app.resourcePicker({
      type: "collection",
      multiple: true,
      selectionIds: form.selectedCollections.map((item) => ({ id: item.id })),
    });

    if (!selection || selection.length === 0) return;

    setForm((currentForm) => ({
      ...currentForm,
      selectedCollections: selection.map((item) => ({
        id: item.id,
        title: item.title,
      })),
    }));
  };

  return (
    <Page
      narrowWidth
      title="Create timer"
      subtitle="Configure the countdown label, schedule, and which products it applies to."
      backAction={{ content: "Timers", onAction: () => navigate("/timer") }}
    >
      <TitleBar title="Create timer" />
      <SaveBar id="timer-save-bar">
        <button variant="primary" onClick={handleSave} disabled={isSaving}>
          Save
        </button>
        <button onClick={handleDiscard} disabled={isSaving}>
          Discard
        </button>
      </SaveBar>

      <BlockStack gap="400">
        <Banner tone="info" title="Times are in UTC">
          <p>
            Date and time fields below are interpreted as <Text as="span" fontWeight="semibold">UTC</Text>.
            Convert from your local zone when planning start and end.
          </p>
        </Banner>

        <Layout>
          <Layout.Section variant="oneHalf">
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingSm">
                    Details
                  </Text>
                  <FormLayout>
                    <TextField
                      label="Label"
                      value={form.label}
                      onChange={(value) =>
                        setForm((currentForm) => ({ ...currentForm, label: value }))
                      }
                      autoComplete="off"
                      helpText="Shown to customers next to the countdown."
                      requiredIndicator
                    />
                    <Select
                      label="Timer type"
                      options={[
                        { label: "Fixed window", value: "FIXED_WINDOW" },
                        { label: "Evergreen (per session)", value: "EVERGREEN" },
                      ]}
                      value={form.timerType}
                      onChange={handleTimerTypeChange}
                      helpText="Fixed window: start and end date/time (UTC). Evergreen: duration per browser session from first view."
                    />
                  </FormLayout>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="400">
                  {form.timerType === "FIXED_WINDOW" ? (
                    <>
                      <Text as="h2" variant="headingSm">
                        Schedule (UTC)
                      </Text>
                      <FormLayout>
                        <FormLayout.Group
                          title="Start"
                          helpText="First moment the countdown is shown."
                          condensed
                        >
                          <TextField
                            label="Start date"
                            type="date"
                            value={form.startDate}
                            onChange={(value) =>
                              setForm((currentForm) => ({ ...currentForm, startDate: value }))
                            }
                            autoComplete="off"
                          />
                          <TextField
                            label="Start time"
                            type="time"
                            value={form.startTime}
                            onChange={(value) =>
                              setForm((currentForm) => ({ ...currentForm, startTime: value }))
                            }
                            autoComplete="off"
                          />
                        </FormLayout.Group>
                        <FormLayout.Group
                          title="End"
                          helpText="When the countdown stops (must be after start)."
                          condensed
                        >
                          <TextField
                            label="End date"
                            type="date"
                            value={form.endDate}
                            onChange={(value) =>
                              setForm((currentForm) => ({ ...currentForm, endDate: value }))
                            }
                            autoComplete="off"
                          />
                          <TextField
                            label="End time"
                            type="time"
                            value={form.endTime}
                            onChange={(value) =>
                              setForm((currentForm) => ({ ...currentForm, endTime: value }))
                            }
                            autoComplete="off"
                          />
                        </FormLayout.Group>
                      </FormLayout>
                    </>
                  ) : (
                    <>
                      <Text as="h2" variant="headingSm">
                        Evergreen duration
                      </Text>
                      <Text as="p" variant="bodySm" tone="subdued">
                        The countdown starts when a visitor first sees this timer in a browser session
                        and runs for the total duration below.
                      </Text>
                      <FormLayout>
                        <FormLayout.Group condensed>
                          <TextField
                            label="Days"
                            type="number"
                            min={0}
                            step={1}
                            value={form.evergreenDays}
                            onChange={(value) =>
                              setForm((currentForm) => ({ ...currentForm, evergreenDays: value }))
                            }
                            autoComplete="off"
                            inputMode="numeric"
                          />
                          <TextField
                            label="Hours"
                            type="number"
                            min={0}
                            max={23}
                            step={1}
                            value={form.evergreenHours}
                            onChange={(value) =>
                              setForm((currentForm) => ({ ...currentForm, evergreenHours: value }))
                            }
                            autoComplete="off"
                            inputMode="numeric"
                          />
                          <TextField
                            label="Minutes"
                            type="number"
                            min={0}
                            max={59}
                            step={1}
                            value={form.evergreenMinutes}
                            onChange={(value) =>
                              setForm((currentForm) => ({ ...currentForm, evergreenMinutes: value }))
                            }
                            autoComplete="off"
                            inputMode="numeric"
                          />
                        </FormLayout.Group>
                      </FormLayout>
                    </>
                  )}
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>

          <Layout.Section variant="oneHalf">
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingSm">
                  Apply to
                </Text>
                <FormLayout>
                  <Select
                    label="Scope"
                    options={[
                      { label: "All products", value: "ALL_PRODUCTS" },
                      { label: "Selected products", value: "SELECTED_PRODUCTS" },
                      {
                        label: "Selected collections",
                        value: "SELECTED_COLLECTIONS",
                      },
                    ]}
                    value={form.applyTo}
                    onChange={handleApplyToChange}
                    helpText="Where this timer can appear on the storefront."
                  />

                  {form.applyTo === "SELECTED_PRODUCTS" ? (
                    <BlockStack gap="200">
                      <InlineStack gap="200" blockAlign="center">
                        <Button onClick={openProductPicker}>Select products</Button>
                      </InlineStack>
                      <Text as="p" variant="bodySm" tone="subdued">
                        {form.selectedProducts.length > 0
                          ? `${form.selectedProducts.length} product(s) selected`
                          : "No products selected yet."}
                      </Text>
                    </BlockStack>
                  ) : null}

                  {form.applyTo === "SELECTED_COLLECTIONS" ? (
                    <BlockStack gap="200">
                      <InlineStack gap="200" blockAlign="center">
                        <Button onClick={openCollectionPicker}>Select collections</Button>
                      </InlineStack>
                      <Text as="p" variant="bodySm" tone="subdued">
                        {form.selectedCollections.length > 0
                          ? `${form.selectedCollections.length} collection(s) selected`
                          : "No collections selected yet."}
                      </Text>
                    </BlockStack>
                  ) : null}
                </FormLayout>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
