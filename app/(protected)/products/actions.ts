"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin, requireBusinessMember } from "@/lib/auth/session";
import {
  productCategoryDeactivationSchema,
  productCategoryInputSchema,
  productCategoryUpdateSchema,
  productDeactivationSchema,
  productImportSchema,
  productInputSchema,
  productUpdateSchema,
} from "@/lib/validation/products";
import {
  createProduct,
  createProductCategory,
  deactivateProduct,
  deactivateProductCategory,
  importProducts,
  updateProduct,
  updateProductCategory,
} from "@/services/products";

export type ProductActionState = Readonly<{
  status?: "success" | "error";
  message?: string;
  errors?: {
    internalCode?: string[];
    name?: string[];
    categoryId?: string[];
    defaultPurchaseCostRon?: string[];
    defaultPurchaseCurrency?: string[];
    defaultPurchaseExchangeRate?: string[];
    defaultSellingPriceRon?: string[];
    confirmation?: string[];
    idempotencyKey?: string[];
    rows?: string[];
  };
}>;

function parseImportRows(value: FormDataEntryValue | null): unknown {
  if (typeof value !== "string" || value.length > 1_000_000) {
    return [];
  }

  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

export async function createProductCategoryAction(
  _previousState: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  const context = await requireBusinessMember();
  const result = productCategoryInputSchema.safeParse({
    name: formData.get("name"),
  });

  if (!result.success) {
    return {
      status: "error",
      message: result.error.issues[0]?.message,
      errors: result.error.flatten().fieldErrors,
    };
  }

  try {
    await createProductCategory(context, result.data);
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Product category could not be created.",
    };
  }

  revalidatePath("/stock");
  return { status: "success", message: "Product category added." };
}

export async function updateProductCategoryAction(
  _previousState: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  const context = await requireBusinessMember();
  const result = productCategoryUpdateSchema.safeParse({
    categoryId: formData.get("categoryId"),
    name: formData.get("name"),
  });

  if (!result.success) {
    return {
      status: "error",
      message: result.error.issues[0]?.message,
      errors: result.error.flatten().fieldErrors,
    };
  }

  try {
    await updateProductCategory(context, result.data);
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Product category could not be updated.",
    };
  }

  revalidatePath("/stock");
  return { status: "success", message: "Product category updated." };
}

export async function deactivateProductCategoryAction(
  _previousState: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  const context = await requireAdmin();
  const result = productCategoryDeactivationSchema.safeParse({
    categoryId: formData.get("categoryId"),
    confirmation: formData.get("confirmation"),
  });

  if (!result.success) {
    return {
      status: "error",
      message: result.error.issues[0]?.message,
      errors: result.error.flatten().fieldErrors,
    };
  }

  try {
    await deactivateProductCategory(context, result.data.categoryId);
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Product category could not be deactivated.",
    };
  }

  revalidatePath("/stock");
  return { status: "success", message: "Product category deactivated." };
}

export async function createProductAction(
  _previousState: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  const context = await requireBusinessMember();
  const result = productInputSchema.safeParse({
    internalCode: formData.get("internalCode"),
    name: formData.get("name"),
    categoryId: formData.get("categoryId"),
    defaultPurchaseCostRon: formData.get("defaultPurchaseCostRon"),
    defaultPurchaseCurrency: formData.get("defaultPurchaseCurrency"),
    defaultPurchaseExchangeRate: formData.get("defaultPurchaseExchangeRate"),
    defaultSellingPriceRon: formData.get("defaultSellingPriceRon"),
  });

  if (!result.success) {
    return {
      status: "error",
      message: result.error.issues[0]?.message,
      errors: result.error.flatten().fieldErrors,
    };
  }

  let productId: string;

  try {
    productId = await createProduct(context, result.data);
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Product could not be created.",
    };
  }

  revalidatePath("/stock");
  redirect(`/products/${productId}?created=1`);
}

export async function updateProductAction(
  _previousState: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  const context = await requireBusinessMember();
  const result = productUpdateSchema.safeParse({
    productId: formData.get("productId"),
    internalCode: formData.get("internalCode"),
    name: formData.get("name"),
    categoryId: formData.get("categoryId"),
    defaultPurchaseCostRon: formData.get("defaultPurchaseCostRon"),
    defaultPurchaseCurrency: formData.get("defaultPurchaseCurrency"),
    defaultPurchaseExchangeRate: formData.get("defaultPurchaseExchangeRate"),
    defaultSellingPriceRon: formData.get("defaultSellingPriceRon"),
  });

  if (!result.success) {
    return {
      status: "error",
      message: result.error.issues[0]?.message,
      errors: result.error.flatten().fieldErrors,
    };
  }

  try {
    await updateProduct(context, result.data);
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Product could not be updated.",
    };
  }

  revalidatePath("/stock");
  revalidatePath(`/products/${result.data.productId}`);
  redirect(`/products/${result.data.productId}?updated=1`);
}

export async function deactivateProductAction(
  _previousState: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  const context = await requireAdmin();
  const result = productDeactivationSchema.safeParse({
    productId: formData.get("productId"),
    confirmation: formData.get("confirmation"),
  });

  if (!result.success) {
    return {
      status: "error",
      message: result.error.issues[0]?.message,
      errors: result.error.flatten().fieldErrors,
    };
  }

  try {
    await deactivateProduct(context, result.data.productId);
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Product could not be deactivated.",
    };
  }

  revalidatePath("/stock");
  revalidatePath(`/products/${result.data.productId}`);
  redirect(`/products/${result.data.productId}?deactivated=1`);
}

export async function importProductsAction(
  _previousState: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  const context = await requireBusinessMember();
  const result = productImportSchema.safeParse({
    idempotencyKey: formData.get("idempotencyKey"),
    rows: parseImportRows(formData.get("rows")),
  });

  if (!result.success) {
    return {
      status: "error",
      message: result.error.issues[0]?.message,
      errors: result.error.flatten().fieldErrors,
    };
  }

  let importedCount: number;

  try {
    importedCount = await importProducts(
      context,
      result.data.idempotencyKey,
      result.data.rows,
    );
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Products could not be imported.",
    };
  }

  revalidatePath("/stock");
  redirect(`/stock?imported=${importedCount}#products`);
}
