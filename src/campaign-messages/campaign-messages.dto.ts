import { IsOptional, IsString, IsBoolean, IsNotEmpty } from 'class-validator';

export class CreateMessageDto {
  @IsNotEmpty()
  @IsString()
  id: string;

  @IsOptional()
  @IsString()
  message?: string;

  @IsNotEmpty()
  sender: bigint;

  @IsNotEmpty()
  receiver: bigint;

  @IsOptional()
  @IsString()
  sender_username?: string;

  @IsOptional()
  @IsString()
  receiver_username?: string;

  @IsNotEmpty()
  @IsString()
  thread_id: string;

  @IsOptional()
  @IsBoolean()
  invite?: boolean;

  @IsOptional()
  @IsBoolean()
  tmp?: boolean;

  @IsOptional()
  @IsBoolean()
  pending_reply?: boolean;

  @IsOptional()
  @IsString()
  client_context?: string;
}
