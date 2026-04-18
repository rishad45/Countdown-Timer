import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Page,
  Layout,
  Card,
  InlineGrid,
  Text,
  FormLayout,
  TextField,
  Select,
  Button,
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
    <Page>
      <TitleBar title="Create Timer" />
      <SaveBar id="timer-save-bar">
        <button variant="primary" onClick={handleSave} disabled={isSaving}>
          Save
        </button>
        <button onClick={handleDiscard} disabled={isSaving}>
          Discard
        </button>
      </SaveBar>
      <Layout>
        <Layout.Section variant="oneHalf">
          <InlineGrid columns={1} gap="400">
            <Card>
              <FormLayout>
                <TextField
                  label="Timer Label"
                  value={form.label}
                  onChange={(value) =>
                    setForm((currentForm) => ({ ...currentForm, label: value }))
                  }
                  autoComplete="off"
                />
                <Select
                  label="Timer Type"
                  options={[
                    { label: "Fixed window", value: "FIXED_WINDOW" },
                    { label: "Evergreen (per session)", value: "EVERGREEN" },
                  ]}
                  value={form.timerType}
                  onChange={handleTimerTypeChange}
                />
              </FormLayout>
            </Card>

            <Card>
              <FormLayout>
                {form.timerType === "FIXED_WINDOW" ? (
                  <>
                    <TextField
                      label="Start Date"
                      type="date"
                      value={form.startDate}
                      onChange={(value) =>
                        setForm((currentForm) => ({ ...currentForm, startDate: value }))
                      }
                      autoComplete="off"
                    />
                    <TextField
                      label="Start Time"
                      type="time"
                      value={form.startTime}
                      onChange={(value) =>
                        setForm((currentForm) => ({ ...currentForm, startTime: value }))
                      }
                      autoComplete="off"
                    />
                    <TextField
                      label="End Date"
                      type="date"
                      value={form.endDate}
                      onChange={(value) =>
                        setForm((currentForm) => ({ ...currentForm, endDate: value }))
                      }
                      autoComplete="off"
                    />
                    <TextField
                      label="End Time"
                      type="time"
                      value={form.endTime}
                      onChange={(value) =>
                        setForm((currentForm) => ({ ...currentForm, endTime: value }))
                      }
                      autoComplete="off"
                    />
                  </>
                ) : (
                  <>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Countdown starts on the visitor's first view in each browser session.
                    </Text>
                    <TextField
                      label="Duration days"
                      type="number"
                      min={0}
                      value={form.evergreenDays}
                      onChange={(value) =>
                        setForm((currentForm) => ({ ...currentForm, evergreenDays: value }))
                      }
                      autoComplete="off"
                    />
                    <TextField
                      label="Duration hours"
                      type="number"
                      min={0}
                      value={form.evergreenHours}
                      onChange={(value) =>
                        setForm((currentForm) => ({ ...currentForm, evergreenHours: value }))
                      }
                      autoComplete="off"
                    />
                    <TextField
                      label="Duration minutes"
                      type="number"
                      min={0}
                      value={form.evergreenMinutes}
                      onChange={(value) =>
                        setForm((currentForm) => ({ ...currentForm, evergreenMinutes: value }))
                      }
                      autoComplete="off"
                    />
                  </>
                )}
              </FormLayout>
            </Card>
          </InlineGrid>
        </Layout.Section>

        <Layout.Section variant="oneHalf">
          <Card>
            <InlineGrid columns={1} gap="200">
              <Text as="h2" variant="headingMd">
                Apply timer to
              </Text>
              <FormLayout>
                <Select
                  label="Method"
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
                />

                {form.applyTo === "SELECTED_PRODUCTS" ? (
                  <>
                    <Button onClick={openProductPicker}>Select products</Button>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      {form.selectedProducts.length > 0
                        ? `${form.selectedProducts.length} product(s) selected`
                        : "No products selected"}
                    </Text>
                  </>
                ) : null}

                {form.applyTo === "SELECTED_COLLECTIONS" ? (
                  <>
                    <Button onClick={openCollectionPicker}>
                      Select collections
                    </Button>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      {form.selectedCollections.length > 0
                        ? `${form.selectedCollections.length} collection(s) selected`
                        : "No collections selected"}
                    </Text>
                  </>
                ) : null}
              </FormLayout>
            </InlineGrid>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
