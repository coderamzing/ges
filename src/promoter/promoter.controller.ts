import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PromoterService } from './promoter.service';

@ApiTags('promoters')
@Controller('promoters')
export class PromoterController {
  constructor(private readonly promoterService: PromoterService) {}
}

