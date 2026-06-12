import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Body,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MediaPhase, Role } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsNumber } from 'class-validator';
import { randomBytes } from 'crypto';
import { Response } from 'express';
import { createReadStream, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PrismaService } from '../prisma/prisma.service';

// Local disk in development; the S3 client swaps in via env without
// changing this controller's contract (key-based storage).
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads');

class UploadMediaDto {
  @IsEnum(MediaPhase)
  phase: MediaPhase;

  // FRD: geotag is mandatory on every job photo.
  @Type(() => Number)
  @IsNumber()
  latitude: number;

  @Type(() => Number)
  @IsNumber()
  longitude: number;

  @Type(() => Date)
  @IsDate()
  capturedAt: Date;
}

@Controller('tickets/:ticketId/media')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MediaController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  @Roles(Role.TECHNICIAN, Role.SALES)
  @UseInterceptors(
    FileInterceptor('photo', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  async upload(
    @Param('ticketId') ticketId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadMediaDto,
  ) {
    if (!file) {
      throw new BadRequestException('photo file is required');
    }
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Only image uploads are allowed');
    }
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    const key = `${ticketId}/${dto.phase.toLowerCase()}-${randomBytes(6).toString('hex')}.jpg`;
    const dir = join(UPLOAD_DIR, ticketId);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(join(UPLOAD_DIR, key), file.buffer);

    return this.prisma.ticketMedia.create({
      data: {
        ticketId,
        phase: dto.phase,
        s3Key: key,
        latitude: dto.latitude,
        longitude: dto.longitude,
        capturedAt: dto.capturedAt,
        deviceTime: dto.capturedAt,
      },
    });
  }

  @Get(':mediaId/file')
  @Roles(Role.ADMIN, Role.BACKEND, Role.TECHNICIAN, Role.SALES)
  async file(
    @Param('ticketId') ticketId: string,
    @Param('mediaId') mediaId: string,
    @Res() res: Response,
  ) {
    const media = await this.prisma.ticketMedia.findFirst({
      where: { id: mediaId, ticketId },
    });
    if (!media || !existsSync(join(UPLOAD_DIR, media.s3Key))) {
      throw new NotFoundException('Media not found');
    }
    res.set('Content-Type', 'image/jpeg');
    createReadStream(join(UPLOAD_DIR, media.s3Key)).pipe(res);
  }
}
