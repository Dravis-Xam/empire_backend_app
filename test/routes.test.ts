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