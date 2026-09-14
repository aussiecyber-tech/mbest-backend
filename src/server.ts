import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import os from 'os';

const PORT = process.env.PORT || 5000;

function getNetworkIP(): string | null {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]!) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return null;
}

app.listen(Number(PORT), '0.0.0.0', () => {
  const networkIP = getNetworkIP();
  console.log(`🚀 Backend API running on:`);
  console.log(`   Local:   http://localhost:${PORT}`);
  if (networkIP) {
    console.log(`   Network: http://${networkIP}:${PORT}  ← accessible on LAN`);
  }
});
