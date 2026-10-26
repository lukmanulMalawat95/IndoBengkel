import { Module } from "@nestjs/common";
import { CommerceController } from "./commerce.controller";
import { CommerceService } from "./commerce.service";
import { PaymentsModule } from "../payments/payments.module";

@Module({
  imports: [PaymentsModule],
  controllers: [CommerceController],
  providers: [CommerceService],
})
export class CommerceModule {}
