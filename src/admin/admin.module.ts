import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { SiteContentController } from './site-content.controller';

@Module({
  controllers: [AdminController, SiteContentController],
  providers: [AdminService],
})
export class AdminModule {}
