const axios = require('axios');
const crypto = require('crypto');

async function simulateWebhook() {
  const payload = {
    event: "messages.upsert",
    instance: "test_instance",
    data: {
      pushName: "Maria Contato",
      message: {
        key: {
          remoteJid: "5511988888888@s.whatsapp.net",
          id: "WID_" + crypto.randomBytes(8).toString('hex'),
          fromMe: false
        },
        message: {
          conversation: "Gostaria de marcar uma reunião amanhã."
        }
      }
    }
  };

  try {
    const res = await axios.post('http://localhost:3005/api/webhooks/evolution', payload);
    console.log('Webhook simulated successfully:', res.data);
  } catch (error) {
    console.error('Failed to simulate webhook:', error.response?.data || error.message);
  }
}

simulateWebhook();
