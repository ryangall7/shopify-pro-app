import { useState } from "react";
import { useForm, useField } from "@shopify/react-form";
import { useParams } from "react-router-dom";
import { Redirect } from "@shopify/app-bridge/actions";
import { useAppBridge } from "@shopify/app-bridge-react";

import {
  ActiveDatesCard,
  CombinationCard,
  DiscountClass,
  DiscountMethod,
  DiscountStatus,
  RequirementType,
  SummaryCard,
  onBreadcrumbAction,
} from "@shopify/discount-app-components";
import {
  Banner,
  Layout,
  Page,
  LegacyStack,
  PageActions,
  Spinner,
  Modal,
  TextContainer,
} from "@shopify/polaris";

import { DiscountConfigProLevelCard } from "../../../components/";
import { DiscountConfigCollectionsCard } from "../../../components/";
import { DiscountConfigTitleCard } from "../../../components/";

import { useAuthenticatedFetch, useDiscount } from "../../../hooks";

const todaysDate = new Date();

export default function DiscountNew() {
  const app = useAppBridge();
  const redirect = Redirect.create(app);
  const currencyCode = "USD";
  const authenticatedFetch = useAuthenticatedFetch();
  const { id } = useParams();
  const { discount, isLoading } = useDiscount(id);
  const [deleteModalActive, setDeleteModalActive] = useState(false);

  const {
    fields: {
      discountTitle,
      discountCode,
      discountMethod,
      combinesWith,
      requirementType,
      requirementSubtotal,
      requirementQuantity,
      usageTotalLimit,
      usageOncePerCustomer,
      startDate,
      endDate,
      configuration,
    },
    submit,
    submitting,
    dirty,
    reset,
    submitErrors,
    makeClean,
  } = useForm({
    fields: {
      discountTitle: useField(discount?.title || ""),
      discountMethod: useField(discount?.method || DiscountMethod.Code),
      discountCode: useField(discount?.code || ""),
      combinesWith: useField(
        discount?.combinesWith || {
          orderDiscounts: false,
          productDiscounts: false,
          shippingDiscounts: false,
        }
      ),
      requirementType: useField(RequirementType.None),
      requirementSubtotal: useField("0"),
      requirementQuantity: useField("0"),
      usageTotalLimit: useField(discount?.usageLimit || null),
      usageOncePerCustomer: useField(discount?.appliesOncePerCustomer || false),
      startDate: useField(discount?.startsAt || todaysDate),
      endDate: useField(discount?.endsAt || null),
      configuration: {
        // Add quantity and percentage configuration
        customerTag: useField(discount?.configuration?.customerTag || ""),
        percentage: useField(discount?.configuration?.percentage || "0"),
        collections: useField(discount?.configuration?.collections || []),
      },
    },
    onSubmit: async (form) => {
      const updatedDiscount = {
        combinesWith: form.combinesWith,
        startsAt: form.startDate,
        endsAt: form.endDate,
        metafields: [
          {
            id: discount.configurationId, // metafield id is required for update
            value: JSON.stringify({
              customerTag: form.configuration.customerTag,
              percentage: parseFloat(form.configuration.percentage),
              collections: form.configuration.collections,
            }),
          },
        ],
      };

      let uri = `/api/discounts/`;
      if (form.discountMethod === DiscountMethod.Code) {
        uri += "code/";

        updatedDiscount.usageLimit = parseInt(form.usageTotalLimit);
        updatedDiscount.appliesOncePerCustomer = form.usageOncePerCustomer;
        updatedDiscount.code = form.discountCode;
        updatedDiscount.title = form.discountCode;
      } else {
        uri += "automatic/";

        updatedDiscount.title = form.discountTitle;
      }

      let response = await authenticatedFetch(uri + id, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discount: updatedDiscount }),
      });

      const {
        errors, // errors like missing scope access
        data,
      } = await response.json();

      const remoteErrors = errors || data?.discountUpdate?.userErrors;

      if (remoteErrors?.length > 0) {
        return { status: "fail", errors: remoteErrors };
      }

      redirect.dispatch(Redirect.Action.ADMIN_SECTION, {
        name: Redirect.ResourceType.Discount,
      });

      return { status: "success" };
    },
  });

  const handleDeleteDiscount = async () => {
    await authenticatedFetch(
      `/api/discounts/${
        discountMethod.value === DiscountMethod.Automatic ? "automatic" : "code"
      }/${discount.id}`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      }
    );

    redirect.dispatch(Redirect.Action.ADMIN_SECTION, {
      name: Redirect.ResourceType.Discount,
    });
  };

  const toggleDeleteModalActive = () => {
    setDeleteModalActive((deleteModalActive) => !deleteModalActive);
  };

  const errorBanner =
    submitErrors.length > 0 ? (
      <Layout.Section>
        <Banner status="critical">
          <p>There were some issues with your form submission:</p>
          <ul>
            {submitErrors.map(({ message }, index) => {
              return <li key={`${message}${index}`}>{message}</li>;
            })}
          </ul>
        </Banner>
      </Layout.Section>
    ) : null;

  return (
    <Page
      title={`Edit ${discountTitle.value}`}
      breadcrumbs={[
        {
          content: "Discounts",
          onAction: () => onBreadcrumbAction(redirect, true),
        },
      ]}
      primaryAction={{
        content: "Save",
        onAction: submit,
        disabled: !dirty,
        loading: submitting,
      }}
    >
      {isLoading && (
        <Layout>
          <LegacyStack distribution="center">
            <Spinner size="large" />
          </LegacyStack>
        </Layout>
      )}

      {!isLoading && (
        <Layout>
          {errorBanner}
          <Layout.Section>
            <form onSubmit={submit}>
              <DiscountConfigTitleCard title={discountTitle} />
              <DiscountConfigProLevelCard configuration={configuration} />
              <DiscountConfigCollectionsCard configuration={configuration} />
              <CombinationCard
                combinableDiscountTypes={combinesWith}
                discountClass={DiscountClass.Product}
                discountDescriptor={
                  discountMethod.value === DiscountMethod.Automatic
                    ? discountTitle.value
                    : discountCode.value
                }
              />
              <ActiveDatesCard
                startDate={startDate}
                endDate={endDate}
                timezoneAbbreviation="EST"
              />
            </form>
          </Layout.Section>
          <Layout.Section secondary>
            <SummaryCard
              header={{
                discountMethod: discountMethod.value,
                discountDescriptor: "Automatic",
                appDiscountType: "Custom Discount",
                isEditing: false,
              }}
              performance={{
                status: DiscountStatus.Scheduled,
                usageCount: 0,
              }}
              minimumRequirements={{
                requirementType: requirementType.value,
                subtotal: requirementSubtotal.value,
                quantity: requirementQuantity.value,
                currencyCode: currencyCode,
              }}
              usageLimits={{
                oncePerCustomer: usageOncePerCustomer.value,
                totalUsageLimit: usageTotalLimit.value,
              }}
              activeDates={{
                startDate: startDate.value,
                endDate: endDate.value,
              }}
            />
          </Layout.Section>
          <Layout.Section>
            <PageActions
              primaryAction={{
                content: "Save discount",
                onAction: submit,
                disabled: !dirty,
                loading: submitting,
              }}
              secondaryActions={[
                {
                  content: "Delete",
                  destructive: true,
                  onAction: toggleDeleteModalActive,
                },
              ]}
            />
          </Layout.Section>

          <Modal
            small
            open={deleteModalActive}
            onClose={toggleDeleteModalActive}
            title="Delete discount"
            primaryAction={{
              content: "Delete",
              destructive: true,
              onAction: handleDeleteDiscount,
            }}
            secondaryActions={[
              {
                content: "Cancel",
                onAction: toggleDeleteModalActive,
              },
            ]}
          >
            <Modal.Section>
              <TextContainer>
                <p>Are you sure you want to delete this discount?</p>
              </TextContainer>
            </Modal.Section>
          </Modal>
        </Layout>
      )}
    </Page>
  );
}
