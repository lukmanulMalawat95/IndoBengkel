import { Module } from "@nestjs/common";
import { configuredPaymentProvider } from "./payment-config";
import { FakePaymentProvider } from "./fake-payment.provider";
import { PAYMENT_PROVIDER, PaymentProvider } from "./payment-provider";
import { PaymentsService } from "./payments.service";

@Module({
  providers: [
    {
      provide: PAYMENT_PROVIDER,
      useFactory: (): PaymentProvider => {
        const name = configuredPaymentProvider();
        switch (name) {
          case "fake":
            return new FakePaymentProvider();
        }
      },
    },
    PaymentsService,
  ],
  exports: [PaymentsService, PAYMENT_PROVIDER],
})
export class PaymentsModule {}
