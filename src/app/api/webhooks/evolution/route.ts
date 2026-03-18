import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { eventEmitter, CHAT_EVENTS } from '@/lib/events';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('Webhook received:', JSON.stringify(body, null, 2));

    const { event, data, instance } = body;
    const eventName = typeof event === 'string' ? event.toUpperCase() : '';

    // 1. Connection Updates (QR Code Scanned, Disconnected)
    if (eventName === 'CONNECTION.UPDATE' || eventName === 'CONNECTION_UPDATE') {
      const state = data.state; // 'open', 'close', 'connecting'
      
      let newStatus = 'connecting';
      if (state === 'open') newStatus = 'connected';
      if (state === 'close') newStatus = 'disconnected';

      // Update the instance status
      await prisma.instance.updateMany({
        where: { name: instance },
        data: { 
          status: newStatus,
          // optionally clear qrCode if connected
          qrCode: state === 'open' ? null : undefined 
        }
      });
      eventEmitter.emit(CHAT_EVENTS.CONNECTION_UPDATE, { instance, status: newStatus });
    }

    // 2. Incoming Messages
    else if (eventName === 'MESSAGES.UPSERT' || eventName === 'MESSAGES_UPSERT') {
      const messageData = data.message;
      const remoteJid = messageData?.key?.remoteJid;
      if (!remoteJid || remoteJid === 'status@broadcast') return NextResponse.json({ success: true });

      const phone = remoteJid.replace('@s.whatsapp.net', '');
      const senderName = data.pushName || phone;
      const text = messageData.message?.conversation || messageData.message?.extendedTextMessage?.text || '';
      const messageId = messageData.key.id;
      const fromMe = messageData.key.fromMe;

      let dbInstance = await prisma.instance.findUnique({ where: { name: instance } });
      if (!dbInstance) {
        dbInstance = await prisma.instance.create({ data: { name: instance, status: 'connected' } });
      }

      let contact = await prisma.contact.findUnique({ where: { phone } });
      if (!contact) {
        contact = await prisma.contact.create({ data: { phone, name: senderName } });
      }

      const newMessage = await prisma.message.upsert({
        where: { id: messageId },
        update: { text, status: fromMe ? 'sent' : 'received' },
        create: {
          id: messageId,
          text,
          status: fromMe ? 'sent' : 'received',
          sender: fromMe ? 'me' : 'contact',
          contactId: contact.id,
          instanceId: dbInstance.id,
        }
      });
      eventEmitter.emit(CHAT_EVENTS.NEW_MESSAGE, newMessage);
    }

    // 3. Message Status Updates (Delivered, Read)
    else if (eventName === 'MESSAGES.UPDATE' || eventName === 'MESSAGES_UPDATE') {
      const messageId = data?.key?.id;
      const statusUpdate = data?.update?.status;

      let newStatus = 'pending';
      if (statusUpdate === 2) newStatus = 'sent';
      else if (statusUpdate === 3) newStatus = 'delivered';
      else if (statusUpdate === 4) newStatus = 'read';

      if (messageId) {
        await prisma.message.updateMany({
          where: { id: messageId },
          data: { status: newStatus }
        });
        eventEmitter.emit(CHAT_EVENTS.MESSAGE_STATUS_UPDATE, { messageId, status: newStatus });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
