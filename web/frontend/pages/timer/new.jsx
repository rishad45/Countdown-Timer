import { useEffect, useMemo, useState } from "react";
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

export default function NewTimerPage() {
  const app = useAppBridge();
  const [savedForm, setSavedForm] = useState({
    label: "",
    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
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

  const handleSave = () => {
    setSavedForm(form);
    app.toast.show("Timer draft saved.");
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
        <button variant="primary" onClick={handleSave}>
          Save
        </button>
        <button onClick={handleDiscard}>Discard</button>
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
              </FormLayout>
            </Card>

            <Card>
              <FormLayout>
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
