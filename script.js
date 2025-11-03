const socket = io();

const cpuEl = document.getElementById('cpu');
const ramEl = document.getElementById('ram');
const playersEl = document.getElementById('players');
const tpsEl = document.getElementById('tps');
const commandInput = document.getElementById('commandInput');
const sendBtn = document.getElementById('sendBtn');
const consoleOutput = document.getElementById('consoleOutput');

function parsePlayersObj(players) {
  const online = players.online;
  const max = players.max;
  const list = players.list;
  let html = `${online} / ${max}<br>`;
  if (list.length > 0) {
    html += list.map(p => `<span class="player">${p}</span>`).join(', ');
  }
  return html;
}

function parseTPSObj(tps, memory) {
  return {
    tpsStr: `1m: ${tps['1m']} | 5m: ${tps['5m']} | 15m: ${tps['15m']}`,
    ramStr: `${memory.used} MB / ${memory.max} MB`
  };
}

socket.on('serverData', (data) => {
  cpuEl.innerText = data.cpu + '%';
  const tpsMemory = parseTPSObj(data.tps, data.memory);
  tpsEl.innerText = tpsMemory.tpsStr;
  ramEl.innerText = tpsMemory.ramStr;
  playersEl.innerHTML = parsePlayersObj(data.players);
});

sendBtn.addEventListener('click', () => {
  const cmd = commandInput.value.trim();
  if (!cmd) return;
  socket.emit('sendCommand', cmd);
  commandInput.value = '';
});

socket.on('commandResult', (res) => {
  consoleOutput.textContent += res + '\n';
  consoleOutput.scrollTop = consoleOutput.scrollHeight;
});
