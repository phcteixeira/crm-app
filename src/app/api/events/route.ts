import { NextRequest } from 'next/server';
import { eventEmitter, CHAT_EVENTS } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const sendEvent = (event: string, data: any) => {
        try {
          const formattedData = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(formattedData));
        } catch (e) {
          // Stream might be closed
        }
      };

      // 1. Send initial connection heartbeat
      sendEvent('connected', { status: 'ok' });

      // 2. Define listeners
      const onNewMessage = (data: any) => sendEvent(CHAT_EVENTS.NEW_MESSAGE, data);
      const onStatusUpdate = (data: any) => sendEvent(CHAT_EVENTS.MESSAGE_STATUS_UPDATE, data);
      const onConnectionUpdate = (data: any) => sendEvent(CHAT_EVENTS.CONNECTION_UPDATE, data);

      // 3. Attach listeners
      eventEmitter.on(CHAT_EVENTS.NEW_MESSAGE, onNewMessage);
      eventEmitter.on(CHAT_EVENTS.MESSAGE_STATUS_UPDATE, onStatusUpdate);
      eventEmitter.on(CHAT_EVENTS.CONNECTION_UPDATE, onConnectionUpdate);

      // 4. Cleanup on disconnect
      req.signal.addEventListener('abort', () => {
        eventEmitter.off(CHAT_EVENTS.NEW_MESSAGE, onNewMessage);
        eventEmitter.off(CHAT_EVENTS.MESSAGE_STATUS_UPDATE, onStatusUpdate);
        eventEmitter.off(CHAT_EVENTS.CONNECTION_UPDATE, onConnectionUpdate);
        try {
          controller.close();
        } catch (e) {}
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      // Allow Cross-Origin if necessary in production (optional based on architecture)
      // 'Access-Control-Allow-Origin': '*',
    },
  });
}
