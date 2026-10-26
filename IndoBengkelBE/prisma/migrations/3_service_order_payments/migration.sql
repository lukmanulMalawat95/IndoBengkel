-- Service invoices can now carry their own payment row, and provider
-- references are unique so a gateway callback can only settle one payment.
ALTER TABLE "Payment" ADD COLUMN     "serviceOrderId" TEXT,
ALTER COLUMN "orderId" DROP NOT NULL;

CREATE UNIQUE INDEX "Payment_serviceOrderId_key" ON "Payment"("serviceOrderId");
CREATE UNIQUE INDEX "Payment_providerRef_key" ON "Payment"("providerRef");
CREATE INDEX "Payment_status_expiresAt_idx" ON "Payment"("status", "expiresAt");

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
