import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsInt,
    IsString,
    IsNotEmpty,
    IsOptional,
    IsEnum,
    IsBoolean,
    IsArray,
    ArrayNotEmpty,
    IsIn,
} from 'class-validator';
import { TemplateType } from '@prisma/client';
import { Transform } from 'class-transformer';

function parseLangInput(value: unknown): string[] | unknown {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
        // Accept both "en" and "en,fr" for backwards compatibility
        return value
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean);
    }
    return value;
}

export class CreateCampaignTemplateDto {
    @ApiProperty({ description: 'ID of the campaign this template belongs to' })
    @IsInt()
    @IsNotEmpty()
    campaignId: number;

    @ApiPropertyOptional({
        description: 'Batch ID for grouping templates (defaults to 1)',
        example: 1,
    })
    @IsInt()
    @IsOptional()
    batchId?: number;

    @ApiProperty({
        description:
            'Languages of the template. Stored as comma-separated string in DB.',
        type: [String],
        example: ['en', 'fr'],
    })
    @Transform(({ value }) => parseLangInput(value))
    @IsArray()
    @ArrayNotEmpty()
    @IsString({ each: true })
    @IsNotEmpty()
    lang: string[];

    @ApiProperty({
        description: 'Type of template',
        enum: TemplateType,
        example: TemplateType.invitation
    })
    @IsEnum(TemplateType)
    @IsNotEmpty()
    type: TemplateType;

    @ApiProperty({ description: 'Name of the template' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ description: 'Content of the template' })
    @IsString()
    @IsNotEmpty()
    content: string;

    @ApiPropertyOptional({
        description: "Template mode: 'auto' (AI-generated) or 'manual' (user-edited)",
        enum: ['auto', 'manual'],
        example: 'auto',
        default: 'auto',
    })
    @IsString()
    @IsIn(['auto', 'manual'])
    @IsOptional()
    mode?: string;

    @ApiProperty({
        description: 'Whether this template is active',
        example: true,
    })
    @IsBoolean()
    @IsNotEmpty()
    isActive: boolean;

    @ApiPropertyOptional({
        description: 'Enable or disable spintax for this template',
        example: true,
        default: true,
    })
    @IsBoolean()
    @IsOptional()
    spintaxEnabled?: boolean;
}

export class UpdateCampaignTemplateDto {
    @ApiPropertyOptional({ description: 'ID of the campaign this template belongs to' })
    @IsInt()
    @IsOptional()
    campaignId?: number;

    @ApiPropertyOptional({
        description: 'Batch ID for grouping templates',
        example: 1,
    })
    @IsInt()
    @IsOptional()
    batchId?: number;

    @ApiPropertyOptional({
        description:
            'Languages of the template. Stored as comma-separated string in DB.',
        type: [String],
        example: ['en', 'fr'],
    })
    @Transform(({ value }) => parseLangInput(value))
    @IsArray()
    @ArrayNotEmpty()
    @IsString({ each: true })
    @IsOptional()
    lang?: string[];

    @ApiPropertyOptional({
        description: 'Type of template',
        enum: TemplateType,
        example: TemplateType.followup
    })
    @IsEnum(TemplateType)
    @IsOptional()
    type?: TemplateType;

    @ApiPropertyOptional({ description: 'Name of the template' })
    @IsString()
    @IsOptional()
    name?: string;

    @ApiPropertyOptional({ description: 'Content of the template' })
    @IsString()
    @IsOptional()
    content?: string;

    @ApiPropertyOptional({
        description: "Template mode: 'auto' (AI-generated) or 'manual' (user-edited)",
        enum: ['auto', 'manual'],
        example: 'manual',
    })
    @IsString()
    @IsIn(['auto', 'manual'])
    @IsOptional()
    mode?: string;

    @ApiPropertyOptional({
        description: 'Whether this template is active',
        example: true,
    })
    @IsBoolean()
    @IsOptional()
    isActive?: boolean;

    @ApiPropertyOptional({
        description: 'Enable or disable spintax for this template',
        example: true,
    })
    @IsBoolean()
    @IsOptional()
    spintaxEnabled?: boolean;
}

export class PreviewTemplateDto {
    @ApiProperty({ description: 'ID of the event to use for template variables' })
    @IsInt()
    @IsNotEmpty()
    eventId: number;

    @ApiProperty({ description: 'Template string with variables to preview' })
    @IsString()
    @IsNotEmpty()
    template: string;
}

export class UpdateTemplateSpintaxDto {
    @ApiProperty({
        description: 'Enable or disable spintax for this template',
        example: true,
    })
    @IsBoolean()
    spintaxEnabled: boolean;
}
