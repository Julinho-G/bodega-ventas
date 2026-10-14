-- Costo del producto congelado en cada línea de venta (para calcular la ganancia real)

-- 1. Se agrega la columna (temporalmente con 0 para las filas existentes)
ALTER TABLE "detalle_venta" ADD COLUMN "costo_unitario" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- 2. Las ventas anteriores a esta migración toman el costo actual del producto
--    (es la mejor aproximación disponible para ese historial)
UPDATE "detalle_venta" AS d
SET "costo_unitario" = p."precio_compra"
FROM "productos" AS p
WHERE p."id" = d."producto_id";

-- 3. Se quita el valor por defecto: desde ahora la aplicación siempre lo envía
ALTER TABLE "detalle_venta" ALTER COLUMN "costo_unitario" DROP DEFAULT;
