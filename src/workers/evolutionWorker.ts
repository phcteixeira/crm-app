import { Worker, Job } from 'bullmq';
import { sendTextMessage, sendAudioMessage } from '../services/evolutionApi';
import { prisma } from '../lib/prisma';
import Redis from 'ioredis';
import Pusher from 'pusher';

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

// Configure Pusher (Soketi) for real-time updates
const pusher = new Pusher({
  appId: process.env.SOKETI_DEFAULT_APP_ID || 'crm-app',
  key: process.env.SOKETI_DEFAULT_APP_KEY || 'soketi-crm-key',
  secret: process.env.SOKETI_DEFAULT_APP_SECRET || 'soketi-crm-secret',
  cluster: 'us-east-1',
  useTLS: false, // Local container uses HTTP
  host: process.env.SOKETI_HOST || '127.0.0.1',
  port: process.env.SOKETI_PORT || '6001',
});

console.log('Starting Evolution API Background Worker...');

const worker = new Worker('message-queue', async (job: Job) => {
  console.log(`[Worker] Processing job ${job.id}`);
  
  if (job.name === 'sendTextMessage') {
    const { messageId, inboxName, contactIdentifier, text } = job.data;

    try {
      // 1. Fire HTTP to Evolution API
      await sendTextMessage(inboxName, contactIdentifier, text);
      
      // 2. Mark as sent internally
      const updatedMessage = await prisma.message.update({
        where: { id: messageId },
        data: { status: 'sent' }
      });

      // 3. Inform Frontend via WebSocket (Soketi/Pusher)
      await pusher.trigger(
        `conversation-${(updatedMessage as any).conversationId}`,
        'MESSAGE_STATUS_UPDATE',
        { messageId: updatedMessage.id, status: 'sent' }
      );

      console.log(`[Worker] Job ${job.id} completed. Message sent.`);

    } catch (error: any) {
      console.error(`[Worker] Job ${job.id} failed:`, error.message);
      
      // Mark as error
      await prisma.message.update({
        where: { id: messageId },
        data: { status: 'error' }
      });

      // We should probably throw so BullMQ retries, but for now we swallow it
      throw new Error(`Failed to send message: ${error.message}`);
    }
  } else if (job.name === 'sendAudioMessage') {
    const { messageId, inboxName, contactIdentifier, audioBase64 } = job.data;

    try {
      // 1. Fire HTTP to Evolution API
      await sendAudioMessage(inboxName, contactIdentifier, audioBase64);
      
      // 2. Mark as sent internally
      const updatedMessage = await prisma.message.update({
        where: { id: messageId },
        data: { status: 'sent' }
      });

      // 3. Inform Frontend via WebSocket (Soketi/Pusher)
      await pusher.trigger(
        `conversation-${(updatedMessage as any).conversationId}`,
        'MESSAGE_STATUS_UPDATE',
        { messageId: updatedMessage.id, status: 'sent' }
      );

      console.log(`[Worker] Job ${job.id} completed. Audio sent.`);

    } catch (error: any) {
      console.error(`[Worker] Job ${job.id} failed:`, error.message);
      
      // Mark as error
      await prisma.message.update({
        where: { id: messageId },
        data: { status: 'error' }
      });

      throw new Error(`Failed to send audio: ${error.message}`);
    }
  }
}, { connection: connection as any });

worker.on('failed', (job, err) => {
  if (job) {
    console.log(`Job ${job.id} completely failed with reason: ${err.message}`);
  }
});

worker.on('error', err => {
  console.error(err);
});
