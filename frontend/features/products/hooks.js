"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { productsApi } from "@/features/products/api";

export function useMyProducts(params = {}) {
  return useQuery({
    queryKey: ["my-products", params],
    queryFn: () => productsApi.listMine(params),
  });
}

export function useProduct(productId) {
  return useQuery({
    queryKey: ["product", productId],
    queryFn: () => productsApi.getById(productId),
    enabled: Boolean(productId),
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: productsApi.create,
    onSuccess(product) {
      queryClient.setQueryData(["product", product.id], product);
      queryClient.invalidateQueries({ queryKey: ["my-products"] });
    },
  });
}

export function useDeleteProduct(productId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => productsApi.remove(productId),
    onSuccess() {
      queryClient.removeQueries({ queryKey: ["product", productId] });
      queryClient.invalidateQueries({ queryKey: ["my-products"] });
    },
  });
}
