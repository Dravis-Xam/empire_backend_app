import assert from "node:assert/strict";
import test from "node:test";
import { api } from "../shared/routes.ts";

test("bulk delete contracts match the route request bodies", () => {
  assert.deepEqual(api.products.deleteBulk.input.parse({ barcodes: ["123"] }), {
    barcodes: ["123"],
  });
  assert.deepEqual(api.products.deleteBulkId.input.parse({ ids: [1, 2] }), {
    ids: [1, 2],
  });

  assert.throws(() => api.products.deleteBulk.input.parse(["123"]));
  assert.throws(() => api.products.deleteBulkId.input.parse([1, 2]));
});

test("purchase order input accepts the CRM cost shape", () => {
  const input = api.purchaseOrders.create.input.parse({
    items: [{ productId: "7", quantity: "3", cost: "12.50" }],
  });

  assert.equal(input.supplierName, "Default Supplier");
  assert.deepEqual(input.items[0], {
    productId: 7,
    productName: undefined,
    quantity: 3,
    unitCost: 12.5,
  });
});