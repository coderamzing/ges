import {
  Processor,
  Process,
  OnQueueCompleted,
  OnQueueFailed,
  OnQueueActive,
  OnQueueStalled,
  OnQueueProgress,
} from '@nestjs/bull';
import type { Job } from 'bull';

@Processor('example')
export class QueueProcessor {
  @Process()
  async handleJob(job: Job) {
    console.log(`Processing job ${job.id} with data:`, job.data);

    // Simulate async work
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Update job progress
    await job.progress(50);

    // More async work
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Complete the job
    return { result: 'Job completed successfully', jobId: job.id };
  }

  // Async event observer for completed jobs
  @OnQueueCompleted()
  async handleCompleted(job: Job, result: any) {
    console.log(`Job ${job.id} completed with result:`, result);
    // Add your async logic here
    // Example: Update database, send notifications, etc.
  }

  // Async event observer for failed jobs
  @OnQueueFailed()
  async handleFailed(job: Job, error: Error) {
    console.log(`Job ${job.id} failed with error:`, error.message);
    // Add your async logic here
    // Example: Log errors, send alerts, retry logic, etc.
  }

  // Async event observer for active jobs
  @OnQueueActive()
  async handleActive(job: Job) {
    console.log(`Job ${job.id} is now active`);
    // Add your async logic here
    // Example: Update job status, log start time, etc.
  }

  // Async event observer for stalled jobs
  @OnQueueStalled()
  async handleStalled(job: Job) {
    console.log(`Job ${job.id} has stalled`);
    // Add your async logic here
    // Example: Log stall, notify administrators, etc.
  }

  // Async event observer for progress updates
  @OnQueueProgress()
  async handleProgress(job: Job, progress: number) {
    console.log(`Job ${job.id} progress: ${progress}%`);
    // Add your async logic here
    // Example: Update progress in database, notify clients, etc.
  }
}

