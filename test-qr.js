const axios = require('axios');

const api = axios.create({
  baseURL: 'https://maracai-api.ckmedia.com.br',
  headers: { apikey: '54a7ce5c4d3e7a4a34b1cac9a970ded2', 'Content-Type': 'application/json' }
});

async function test() {
  try {
    const name = 'testqr6';
    console.log('1. Creating...');
    const createRes = await api.post('/instance/create', {
      instanceName: name, qrcode: true, integration: 'WHATSAPP-BAILEYS'
    });
    console.log('Create Res:', JSON.stringify(createRes.data).substring(0, 200));

    console.log('\n2. Connect...');
    const connectRes = await api.get(`/instance/connect/${name}`);
    console.log('Connect Res keys:', Object.keys(connectRes.data));
    console.log('Connect base64 exists?', !!connectRes.data.base64);
    if (connectRes.data.base64) {
      console.log('Base64 prefix:', connectRes.data.base64.substring(0, 30));
    }

    console.log('\n3. State (after 1s)...');
    await new Promise(r => setTimeout(r, 1000));
    const stateRes = await api.get(`/instance/connectionState/${name}`);
    console.log('State Res keys:', Object.keys(stateRes.data.instance));
    console.log('State QR exists?', !!stateRes.data.instance.qr);

    // cleanup
    await api.delete(`/instance/delete/${name}`);
  } catch (err) {
    console.error(err.response?.data || err.message);
  }
}

test();
