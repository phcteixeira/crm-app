import axios from 'axios';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;

const getApiClient = (customUrl?: string, customKey?: string) => {
  return axios.create({
    baseURL: customUrl || EVOLUTION_API_URL,
    headers: {
      'apikey': customKey || EVOLUTION_API_KEY,
      'Content-Type': 'application/json'
    }
  });
};

export const createInstance = async (
  instanceName: string, 
  webhookUrl: string, 
  customUrl?: string, 
  customKey?: string
) => {
  const api = getApiClient(customUrl, customKey);
  const response = await api.post(`/instance/create`, {
    instanceName,
    qrcode: true,
    integration: "WHATSAPP-BAILEYS",
    webhook: {
      url: webhookUrl,
      byEvents: false,
      base64: true,
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

export const connectInstance = async (instanceName: string, customUrl?: string, customKey?: string) => {
  const api = getApiClient(customUrl, customKey);
  const response = await api.get(`/instance/connect/${instanceName}`);
  return response.data;
};

export const deleteInstance = async (instanceName: string, customUrl?: string, customKey?: string) => {
  const api = getApiClient(customUrl, customKey);
  const response = await api.delete(`/instance/delete/${instanceName}`);
  return response.data;
};

export const fetchConnectionState = async (instanceName: string, customUrl?: string, customKey?: string) => {
  const api = getApiClient(customUrl, customKey);
  const response = await api.get(`/instance/connectionState/${instanceName}`);
  return response.data;
};

export const listInstances = async (customUrl?: string, customKey?: string) => {
  const api = getApiClient(customUrl, customKey);
  const response = await api.get(`/instance/fetchInstances`);
  return response.data;
};


export const sendTextMessage = async (instanceName: string, number: string, text: string, customUrl?: string, customKey?: string) => {
  const api = getApiClient(customUrl, customKey);
  const response = await api.post(`/message/sendText/${instanceName}`, {
    number,
    text,
  });
  return response.data;
};

export const sendAudioMessage = async (instanceName: string, number: string, audioBase64: string, customUrl?: string, customKey?: string) => {
  const api = getApiClient(customUrl, customKey);
  // Strip the 'data:audio/webm;base64,' prefix just in case Evolution API prefers raw base64
  const base64Data = audioBase64.includes('base64,') ? audioBase64.split('base64,')[1] : audioBase64;
  const response = await api.post(`/message/sendWhatsAppAudio/${instanceName}`, {
    number,
    audio: base64Data,
    encoding: true
  });
  return response.data;
};

export const setWebhooks = async (instanceName: string, webhookUrl: string, customUrl?: string, customKey?: string) => {
  const api = getApiClient(customUrl, customKey);
  const response = await api.post(`/webhook/set/${instanceName}`, {
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

// For backward compatibility if anything else uses it directly
export const evolutionApi = getApiClient();
