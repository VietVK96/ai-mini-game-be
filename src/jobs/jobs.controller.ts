import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Res,
  StreamableFile,
  UploadedFiles,
  UseInterceptors
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { CreateJobDto } from './dto/create-job.dto';
import { JobsService } from './jobs.service';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post()
  @UseInterceptors(FilesInterceptor('file', 1))
  async createJob(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() body: any,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }

    const file = files[0];

    const createJobDto: CreateJobDto = {
      file: file,
      prompt: body.prompt || '',
      templateId: body.templateId || '',
    };

    return await this.jobsService.createJob(createJobDto);
  }

  @Get(':id/stream')
  async streamJob(@Param('id') id: string, @Res() res: Response) {
    try {
      console.log(`🌊 SSE: Starting SSE stream for job: ${id}`);
      
      const stream = await this.jobsService.getJobStream(id);
      console.log(`🌊 SSE: Stream created for job: ${id}`);
      
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

      // Send initial connection event
      res.write(`data: ${JSON.stringify({ type: 'connected', data: { jobId: id } })}\n\n`);

      stream.pipe(res);

      // Handle client disconnect
      res.on('close', () => {
        console.log(`SSE stream closed for job: ${id}`);
        stream.destroy();
      });

    } catch (error) {
      console.error(`SSE stream error for job ${id}:`, error);
      res.status(500).json({ error: 'Failed to create stream' });
    }
  }

  @Get(':id/result')
  async getJobResult(@Param('id') id: string) {
    const result = await this.jobsService.getJobResult(id);
    
    if (!result) {
      throw new NotFoundException('Job result not found or expired');
    }

    return new StreamableFile(result.buffer, {
      type: result.mimeType,
      disposition: `attachment; filename="ai-generated-${id}.webp"`,
    });
  }

  @Get(':id/status')
  async getJobStatus(@Param('id') id: string) {
    return this.jobsService.getJobStatus(id);
  }

  @Delete(':id')
  async cancelJob(@Param('id') id: string) {
    return this.jobsService.cancelJob(id);
  }

  @Get('test/queue')
  async testQueue() {
    return this.jobsService.testQueue();
  }

  @Delete('test/queue')
  async clearQueue() {
    return this.jobsService.clearQueue();
  }
}
