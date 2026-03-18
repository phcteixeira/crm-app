import axios from 'axios';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;

export const evolutionApi = axios.create({
  baseURL: EVOLUTION_API_URL,
  headers: {
    'apikey': EVOLUTION_API_KEY,
    'Content-Type': 'application/json'
  }
});

export const createInstance = async (instanceName: string, webhookUrl: string) => {
  const response = await evolutionApi.post(`/instance/create`, {
    instanceName,
    qrcode: true,
    integration: "WHATSAPP-BAILEYS",
    webhook: {
      url: webhookUrl,
      byEvents: false,
      base64: true, // <-- SET TO TRUE
      events: [
        "MESSAGES_UPSERT",
        "MESSAGES_UPDATE",
        "SEND_MESSAGE",
        "CONNECTION_UPDATE"
      ]
    }
  });
  return response.data;
};

export const connectInstance = async (instanceName: string) => {
  const response = await evolutionApi.get(`/instance/connect/${instanceName}`);
  return response.data;
};

export const deleteInstance = async (instanceName: string) => {
  const response = await evolutionApi.delete(`/instance/delete/${instanceName}`);
  return response.data;
};

export const fetchConnectionState = async (instanceName: string) => {
  const response = await evolutionApi.get(`/instance/connectionState/${instanceName}`);
  return response.data;
};

export const listInstances = async () => {
  const response = await evolutionApi.get(`/instance/fetchInstances`);
  return response.data;
};


export const sendTextMessage = async (instanceName: string, number: string, text: string) => {
  const response = await evolutionApi.post(`/message/sendText/${instanceName}`, {
    number,
    text,
  });
  return response.data;
};

export const sendAudioMessage = async (instanceName: string, number: string, audioBase64: string) => {
  // Strip the 'data:audio/webm;base64,' prefix just in case Evolution API prefers raw base64
  const base64Data = audioBase64.includes('base64,') ? audioBase64.split('base64,')[1] : audioBase64;
  const response = await evolutionApi.post(`/message/sendWhatsAppAudio/${instanceName}`, {
    number,
    audio: base64Data,
    encoding: true
  });
  return response.data;
};

export const setWebhooks = async (instanceName: string, webhookUrl: string) => {
  const response = await evolutionApi.post(`/webhook/set/${instanceName}`, {
    enabled: true,
    url: webhookUrl,
    byEvents: false,
    base64: true,
    events: [
      "MESSAGES_UPSERT",
      "MESSAGES_UPDATE",
      "SEND_MESSAGE"
    ]
  });
  return response.data;
};
