import { Controller, Get, Param } from '@nestjs/common';
import { AdminService } from './admin.service';

@Controller('site-content')
export class SiteContentController {
  constructor(private readonly adminService: AdminService) {}

  @Get(':pageKey')
  getPublishedContent(@Param('pageKey') pageKey: string) {
    return this.adminService.getPublicSiteContent(pageKey);
  }
}
