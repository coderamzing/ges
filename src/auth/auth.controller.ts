import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto, LoginResponseDto, MeResponseDto } from './auth.dto';
import { JwtAuthGuard } from 'guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with promoter email' })
  @ApiResponse({ status: 200, description: 'Login successful, returns JWT token' })
  @ApiResponse({ status: 401, description: 'Invalid email or promoter not found' })
  async login(@Body() loginDto: LoginDto): Promise<LoginResponseDto> {
    return this.authService.login(loginDto);
  }




  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get logged-in user' })
  @ApiResponse({ status: 200, description: 'Returns JWT token and user details' })
  @ApiResponse({ status: 401, description: 'User not found' })
  @UseGuards(JwtAuthGuard)
  async getCurrentUser(@Req() req: Request): Promise<MeResponseDto> {
    return this.authService.getCurrentUser(req);
  }






}

