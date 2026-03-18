import { EventEmitter } from 'events'

// Global event emitter instance to share across the Next.js process
// In Next.js dev mode, we need to attach it to global so it survives HMR (Hot Module Replacement)
const globalForEvents = global as unknown as { eventEmitter: EventEmitter }

export const eventEmitter = globalForEvents.eventEmitter || new EventEmitter()

if (process.env.NODE_ENV !== 'production') {
  globalForEvents.eventEmitter = eventEmitter
}

export const CHAT_EVENTS = {
  NEW_MESSAGE: 'NEW_MESSAGE',
  MESSAGE_STATUS_UPDATE: 'MESSAGE_STATUS_UPDATE',
  CONNECTION_UPDATE: 'CONNECTION_UPDATE',
}
