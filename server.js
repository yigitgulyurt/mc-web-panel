// server.js başına ekle
const consoleWarn = console.warn;
console.warn = (msg, ...args) => {
  if (typeof msg === 'string' &&
      (msg.includes("getconf CLK_TCK") || msg.includes("getconf PAGESIZE") ||
       msg.includes("We couldn't find uptime"))) return;
  consoleWarn(msg, ...args);
};



const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Rcon } = require('rcon-client');
const pidusage = require('pidusage');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;

// RCON ayarları
const RCON_HOST = '127.0.0.1';
const RCON_PORT = 25575;
const RCON_PASSWORD = '';

// Minecraft PID (ps aux | grep java ile bul)
const MINECRAFT_PID = 123456; // Burayı kendi PID'inle değiştir

let rcon;

// Statik dosyaları sun
app.use(express.static(__dirname));

// Renk kodlarını temizleme
function removeColorCodes(str) {
  return str.replace(/§./g, '');
}

// RCON bağlantısı
async function connectRcon() {
  try {
    rcon = await Rcon.connect({
      host: RCON_HOST,
      port: RCON_PORT,
      password: RCON_PASSWORD
    });
    console.log('RCON bağlantısı başarılı!');
  } catch (err) {
    console.error('RCON bağlantı hatası:', err);
  }
}
connectRcon();

// Socket.IO
io.on('connection', (socket) => {
  console.log('Frontend bağlandı');

  // Konsol komutu gönder
  socket.on('sendCommand', async (cmd) => {
    if (rcon) {
      try {
        const res = await rcon.send(cmd);
        socket.emit('commandResult', removeColorCodes(res));
      } catch (err) {
        socket.emit('commandResult', 'Hata: ' + err.message);
      }
    } else {
      socket.emit('commandResult', 'RCON bağlantısı yok');
    }
  });
});

// Oyuncu parse
function parsePlayers(str) {
  const match = str.match(/There are (\d+) of a max of (\d+) players(?: online: (.*))?/);
  if (!match) return { online: 0, max: 0, list: [] };

  const online = parseInt(match[1]);
  const max = parseInt(match[2]);
  const list = match[3] ? match[3].split(', ').map(s => s.trim()) : [];

  return { online, max, list };
}

// TPS & Memory parse
function parseTPS(str) {
  const tpsMatch = str.match(/TPS.*:.*?([\d.]+),.*?([\d.]+),.*?([\d.]+)/);
  const memMatch = str.match(/Current Memory Usage: (\d+)\/(\d+)/);

  const tps = tpsMatch ? { '1m': tpsMatch[1], '5m': tpsMatch[2], '15m': tpsMatch[3] } : { '1m':'-', '5m':'-', '15m':'-' };
  const memory = memMatch ? { used: memMatch[1], max: memMatch[2] } : { used: '-', max: '-' };

  return { tps, memory };
}

// Veri güncelleme
const os = require('os');
const cores = os.cpus().length; // 8 çekirdekli cihaz için otomatik

setInterval(async () => {
  try {
    const stats = await pidusage(MINECRAFT_PID);

    // CPU normalize et
    const cpuPercent = Math.min(stats.cpu, 100).toFixed(1);

    // RAM
    const ramMB = (stats.memory / 1024 / 1024).toFixed(1);

    // Oyuncular ve TPS
    let playersRaw = 'There are 0 of a max of 0 players online';
    let tpsRaw = 'TPS from last 1m, 5m, 15m: *20.0, *20.0, *20.0 Current Memory Usage: 0/0 mb';
    if (rcon) {
      try {
        const list = await rcon.send('list');
        playersRaw = removeColorCodes(list);

        const tpsResult = await rcon.send('tps');
        tpsRaw = removeColorCodes(tpsResult);
      } catch {}
    }

    const players = parsePlayers(playersRaw);
    const tpsData = parseTPS(tpsRaw);

    io.emit('serverData', {
      cpu: cpuPercent,
      ram: ramMB,
      players,
      tps: tpsData.tps,
      memory: tpsData.memory
    });

  } catch (err) {
    // Terminali temiz tutmak için uyarı mesajlarını yazma
  }
}, 2000);


server.listen(PORT, () => {
  console.log(`Panel çalışıyor: http://localhost:${PORT}`);
});
