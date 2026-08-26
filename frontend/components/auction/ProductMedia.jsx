import { PackageOpen } from "lucide-react";
import { getProduct } from "@/utils/auction";

export default function ProductMedia({ auction, className = "" }) {
  const product = getProduct(auction);
  const image = product.images?.[0];

  if (image) {
    return <img src={image} alt={product.name || "Auction product"} className={`product-image ${className}`} />;
  }

  return (
    <div className={`product-placeholder ${className}`} role="img" aria-label={`No image available for ${product.name || "this auction"}`}>
      <PackageOpen />
      <span>Image not provided</span>
    </div>
  );
}

