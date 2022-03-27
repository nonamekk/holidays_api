import { CacheModule, Module } from "@nestjs/common";
import { DescriptorService } from "./descriptor.service";

@Module({
  imports: [CacheModule.register()],
  controllers: [],
  providers: [DescriptorService],
  exports: [DescriptorService]
})
export class DescriptorModule {}
