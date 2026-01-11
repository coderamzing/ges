import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';

@Injectable()
export class QueueService {
  constructor(
    @InjectQueue('example') private readonly exampleQueue: Queue,
  ) {}

  // Helper method to add jobs to the queue
  async addJob(data: any) {
    return this.exampleQueue.add(data);
  }

  // Method to get the queue instance if you need direct access
  getQueue(): Queue {
    return this.exampleQueue;
  }
}

