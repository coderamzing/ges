import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class LoginDto {
  @ApiProperty({ description: 'Promoter email address', example: 'promoter@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class LoginResponseDto {
  @ApiProperty({ description: 'JWT access token' })
  access_token: string;
}


export class MeResponseDto {
  access_token: string;
  user: {
    id: bigint;
    email: string | null;
    name?: string | null;
    username?: string | null;
    role?: string | null;
    city?: string | null;
    status?: string | null;
    userType?: string | null;
    paid?: boolean | null;
    approved?: boolean | null;
    pictureUrl?: string | null;
  };
}
