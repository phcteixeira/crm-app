'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Pusher from 'pusher-js'

type Props = {
  userId: string
}

export function RealtimeSidebar({ userId }: Props) {
  const router = useRouter()

  useEffect(() => {
    if (!userId) return

    console.log('Initializing Real-time Sidebar Listener for user:', userId);
    
    const isProduction = window.location.protocol === 'https:';
    const envHost = process.env.NEXT_PUBLIC_SOKETI_HOST;
    const wsHost = (envHost && envHost !== 'localhost' && envHost !== '127.0.0.1') 
      ? envHost 
      : window.location.hostname;
    const wsPort = parseInt(process.env.NEXT_PUBLIC_SOKETI_PORT || (isProduction ? '443' : '6001'));

    const pusher = new Pusher(process.env.NEXT_PUBLIC_SOKETI_APP_KEY || 'soketi-crm-key', {
      wsHost: wsHost,
      wsPort: wsPort,
      forceTLS: isProduction,
      disableStats: true,
      enabledTransports: ['ws', 'wss'],
      cluster: 'us-east-1'
    });

    const channel = pusher.subscribe(`user-${userId}-events`);

    channel.bind('CONVERSATION_UPDATE', (data: any) => {
      console.log('Real-time Sidebar update received:', data);
      router.refresh();
    });

    // Also listen for connection updates to refresh the "online" badge
    const systemChannel = pusher.subscribe('system-events');
    systemChannel.bind('CONNECTION_UPDATE', () => {
      router.refresh();
    });

    return () => {
      channel.unbind_all();
      systemChannel.unbind_all();
      pusher.unsubscribe(`user-${userId}-events`);
      pusher.unsubscribe('system-events');
      pusher.disconnect();
    }
  }, [userId, router])

  return null // This component doesn't render anything, it just listens and refreshes
}
