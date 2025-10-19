// utils/logManager.js
export const clients = [];
const logHistory = [];
const MAX_LOGS = 1000;

export function addLogClient(res) {
  clients.push(res);
}

export function removeLogClient(res) {
  const index = clients.indexOf(res);
  if (index > -1) clients.splice(index, 1);
}

export function getLogHistory() {
  return logHistory.slice(-MAX_LOGS);
}

export function broadcastLog(message) {
  const timestamp = new Date().toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Bangkok"
  });

  const logEntry = `[ ${timestamp} ] ${message}`;
  logHistory.push(logEntry);

  if (logHistory.length > MAX_LOGS) {
    logHistory.splice(0, logHistory.length - MAX_LOGS);
  }

  const data = `data: ${logEntry}\n\n`;
  clients.forEach(clients => {
    try {
      clients.write(data);
    } catch (error) {
      console.error("Error sending log to clients:", error);
    }
  });
}
