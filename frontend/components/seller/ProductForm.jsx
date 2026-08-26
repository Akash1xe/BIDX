"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, CheckCircle2, Copy, LoaderCircle, PackagePlus } from "lucide-react";
import { toast } from "sonner";
import FormField from "@/components/auth/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useCreateProduct } from "@/features/products/hooks";
import { PRODUCT_CONDITIONS, productSchema, toProductPayload } from "@/features/products/schema";

export default function ProductForm() {
  const createProduct = useCreateProduct();
  const [created, setCreated] = useState(null);
  const form = useForm({
    resolver: zodResolver(productSchema),
    defaultValues: { name: "", description: "", category: "", condition: "USED", imageUrls: "" },
  });

  async function submit(values) {
    try {
      const product = await createProduct.mutateAsync(toProductPayload(values));
      setCreated(product);
      toast.success("Product created by the BidX backend.");
    } catch {
      // Normalized API error is rendered below.
    }
  }

  async function copyId() {
    await navigator.clipboard.writeText(created.id);
    toast.success("Product ID copied.");
  }

  if (created) {
    return <div className="seller-success"><CheckCircle2 /><p className="eyebrow">Product created</p><h2>{created.name}</h2><p>BidX returned this product ID. Use it to create the auction.</p><div className="product-id"><code>{created.id}</code><Button variant="outline" size="icon" onClick={copyId} aria-label="Copy product ID"><Copy /></Button></div><div className="seller-success-actions"><Button asChild className="primary-button"><Link href={`/seller/auctions/create?productId=${encodeURIComponent(created.id)}`}>Create its auction <ArrowRight /></Link></Button><Button variant="outline" onClick={() => { setCreated(null); form.reset(); }}>Create another product</Button></div></div>;
  }

  return (
    <form className="seller-form" onSubmit={form.handleSubmit(submit)} noValidate>
      <div className="seller-form-heading"><PackagePlus /><div><h2>Product information</h2><p>Fields match the current Product Service contract exactly.</p></div></div>
      <div className="seller-form-grid">
        <FormField id="product-name" label="Product name" error={form.formState.errors.name?.message}><Input id="product-name" placeholder="Leica M6 Classic" {...form.register("name")} /></FormField>
        <FormField id="product-category" label="Category" error={form.formState.errors.category?.message}><Input id="product-category" placeholder="Cameras" {...form.register("category")} /></FormField>
        <FormField id="product-condition" label="Condition" error={form.formState.errors.condition?.message}><NativeSelect id="product-condition" {...form.register("condition")}>{PRODUCT_CONDITIONS.map((condition) => <NativeSelectOption key={condition} value={condition}>{condition.replaceAll("_", " ")}</NativeSelectOption>)}</NativeSelect></FormField>
        <FormField id="product-images" label="Image URLs — one per line" error={form.formState.errors.imageUrls?.message}><Textarea id="product-images" rows={4} placeholder="https://example.com/product.jpg" {...form.register("imageUrls")} /></FormField>
        <div className="seller-form-span"><FormField id="product-description" label="Description" error={form.formState.errors.description?.message}><Textarea id="product-description" rows={7} placeholder="Describe condition, provenance, included accessories, and known marks." {...form.register("description")} /></FormField></div>
      </div>
      {createProduct.error && <p className="seller-form-error">{createProduct.error.message}</p>}
      <Button type="submit" className="primary-button seller-submit" disabled={createProduct.isPending}>{createProduct.isPending ? <><LoaderCircle className="spin" /> Creating…</> : <>Create product <ArrowRight /></>}</Button>
    </form>
  );
}
