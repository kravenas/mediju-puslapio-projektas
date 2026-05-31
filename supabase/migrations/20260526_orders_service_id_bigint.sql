-- creator_services.id is bigint (serial), but orders.service_id was created as uuid.
-- Type mismatch made every checkout fail with: invalid input syntax for type uuid: "12"
-- orders is currently empty (no payments completed), so the column can be dropped/recreated safely.

ALTER TABLE orders DROP COLUMN IF EXISTS service_id;
ALTER TABLE orders ADD COLUMN service_id bigint REFERENCES creator_services(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS orders_service_id_idx ON orders (service_id);
