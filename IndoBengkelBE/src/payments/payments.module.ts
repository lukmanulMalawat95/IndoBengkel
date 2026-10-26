import { Module } from "@nestjs/common";
import { configuredPaymentProvider, midtransConfig } from "./payment-config";
import { FakePaymentProvider } from "./fake-payment.provider";
import { MidtransPaymentProvider } from "./midtrans-payment.provider";
import { PAYMENT_PROVIDER, PaymentProvider } from "./payment-provider";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";

@Module({
  controllers: [PaymentsController],
  providers: [
    {
      provide: PAYMENT_PROVIDER,
      useFactory: (): PaymentProvider => {
        const name = configuredPaymentProvider();
        switch (name) {
          case "fake":
            return new FakePaymentProvider();
          case "midtrans":
            return new MidtransPaymentProvider(midtransConfig());
        }
      },
    },
    PaymentsService,
  ],
  exports: [PaymentsService, PAYMENT_PROVIDER],
})
export class PaymentsModule {}
