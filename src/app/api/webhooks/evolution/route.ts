import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('Webhook received:', JSON.stringify(body, null, 2));

    const { event, data, instance } = body;

    // 1. Connection Updates (QR Code Scanned, Disconnected)
    if (event === 'connection.update') {
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
    }

    // 2. Incoming Messages
    else if (event === 'messages.upsert') {
      const messageData = data.message;
      const remoteJid = messageData.key.remoteJid;
      if (remoteJid === 'status@broadcast') return NextResponse.json({ success: true });

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

      await prisma.message.create({
        data: {
          id: messageId,
          text,
          status: fromMe ? 'sent' : 'received',
          sender: fromMe ? 'me' : 'contact',
          contactId: contact.id,
          instanceId: dbInstance.id,
        }
      });
    }

    // 3. Message Status Updates (Delivered, Read)
    else if (event === 'messages.update') {
      const messageId = data.key.id;
      const statusUpdate = data.update.status;

      let newStatus = 'pending';
      if (statusUpdate === 2) newStatus = 'sent';
      else if (statusUpdate === 3) newStatus = 'delivered';
      else if (statusUpdate === 4) newStatus = 'read';

      await prisma.message.updateMany({
        where: { id: messageId },
        data: { status: newStatus }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
