import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import Pusher from 'pusher';
import { saveFile } from '@/lib/storage';

const pusher = new Pusher({
  appId: process.env.SOKETI_DEFAULT_APP_ID || 'crm-app',
  key: process.env.SOKETI_DEFAULT_APP_KEY || 'soketi-crm-key',
  secret: process.env.SOKETI_DEFAULT_APP_SECRET || 'soketi-crm-secret',
  cluster: 'us-east-1',
  useTLS: false,
  host: process.env.SOKETI_HOST || '127.0.0.1',
  port: process.env.SOKETI_PORT || '6001',
});
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
      // Update the Inbox status
      await (prisma as any).inbox.updateMany({
        where: { name: instance },
        data: { 
          status: newStatus,
        }
      });
      
      await pusher.trigger('system-events', 'CONNECTION_UPDATE', { instance, status: newStatus });
    }

    // 2. Incoming Messages
    else if (eventName === 'MESSAGES.UPSERT' || eventName === 'MESSAGES_UPSERT') {
      const messageData = data.message || {};
      const key = messageData.key || data.key || {};
      const remoteJid = key.remoteJid;
      if (!remoteJid || remoteJid === 'status@broadcast') return NextResponse.json({ success: true });

      const phone = remoteJid.replace('@s.whatsapp.net', '');
      const messageId = key.id;
      const fromMe = key.fromMe;

      // Se a mensagem for enviada por nós, o data.pushName traz o nosso próprio nome.
      // Nesse caso usamos o telefone como fallback até que o cliente responda.
      const senderName = (!fromMe && data.pushName) ? data.pushName : phone;
      
      // Handle both nested and flat message content
      const content = messageData.message || messageData || {};
      const text = content.conversation || content.extendedTextMessage?.text || data.message?.conversation || '';
      
      // Media Handling
      let mediaUrl = null;
      let mediaType = null;
      const msgType = data.messageType || '';
      
      const isMedia = ['imageMessage', 'audioMessage', 'videoMessage', 'documentMessage', 'stickerMessage', 'image', 'audio', 'video', 'document', 'sticker'].includes(msgType);
      
      if (isMedia) {
        mediaType = msgType.replace('Message', '');
        if (data.message?.base64) {
           const nestedMsg = data.message?.message || {};
           const mediaObj = nestedMsg.imageMessage || nestedMsg.audioMessage || nestedMsg.videoMessage || nestedMsg.documentMessage || nestedMsg.stickerMessage || {};
           const mimetype = mediaObj.mimetype || 'application/octet-stream';
           
           // PERFORMANCE: Save file to disk instead of using base64 data URL
           try {
             const fileName = `${messageId}-${Date.now()}`;
             const savedUrl = await saveFile(`data:${mimetype};base64,${data.message.base64}`, fileName);
             mediaUrl = savedUrl;
           } catch (saveError: any) {
             console.error('Failed to save media file:', saveError.message);
             // Fallback to data URL if save fails (optional, but for performance we might skip)
             mediaUrl = `data:${mimetype};base64,${data.message.base64}`;
           }
        }
      }
      
      let inbox = await (prisma as any).inbox.findUnique({ where: { name: instance } });
      if (!inbox) {
        inbox = await (prisma as any).inbox.create({ data: { name: instance, status: 'connected' } });
      }

      let contact = await (prisma as any).contact.findUnique({ where: { identifier: phone } });
      if (!contact) {
        contact = await (prisma as any).contact.create({ data: { identifier: phone, name: senderName } });
      } else if (!fromMe && data.pushName && contact.name !== data.pushName) {
        // Se o cliente respondeu e agora temos o nome real dele, e for diferente do que está no banco (como seu nome ou só o número),
        // fazemos a atualização do nome no banco de dados.
        contact = await (prisma as any).contact.update({
          where: { id: contact.id },
          data: { name: data.pushName }
        });
      }

      const conversation = await (prisma as any).conversation.upsert({
        where: { inboxId_contactId: { inboxId: inbox.id, contactId: contact.id } },
        update: {},
        create: { inboxId: inbox.id, contactId: contact.id, status: 'open' }
      });

      const newMessage = await (prisma as any).message.upsert({
        where: { id: messageId },
        update: { text, status: fromMe ? 'sent' : 'received', mediaUrl, mediaType },
        create: {
          id: messageId,
          text,
          status: fromMe ? 'sent' : 'received',
          senderType: fromMe ? 'agent' : 'contact',
          conversationId: conversation.id,
          mediaUrl,
          mediaType
        }
      });
      
      try {
        await pusher.trigger(`conversation-${conversation.id}`, 'NEW_MESSAGE', newMessage);
        // Also notify the user's global chat channel to refresh the sidebar
        if (inbox.userId) {
          await pusher.trigger(`user-${inbox.userId}-events`, 'CONVERSATION_UPDATE', {
            conversationId: conversation.id,
            lastMessage: newMessage.text,
            contactName: contact.name
          });
        }
      } catch (pusherError: any) {
        console.error('Pusher notification failed:', pusherError.message);
      }
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
        await (prisma as any).message.updateMany({
          where: { id: messageId },
          data: { status: newStatus }
        });
        const updatedMsg = await (prisma as any).message.findUnique({ where: { id: messageId } });
        if (updatedMsg) {
          try {
            await pusher.trigger(`conversation-${(updatedMsg as any).conversationId}`, 'MESSAGE_STATUS_UPDATE', { 
              messageId, 
              status: newStatus 
            });
          } catch (pusherError: any) {
            console.error('Pusher status update failed:', pusherError.message);
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
