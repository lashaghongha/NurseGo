import * as signalR from '@microsoft/signalr';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const HUB_URL  = API_BASE.replace('/api', '') + '/hubs/orders';

let connection = null;

export const signalRService = {
  // კავშირის დამყარება
  connect: async () => {
    if (connection && connection.state === signalR.HubConnectionState.Connected) return;

    const stored = localStorage.getItem('nursego_user');
    const token = stored ? JSON.parse(stored).token : null;

    connection = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL, token ? { accessTokenFactory: () => token } : {})
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    await connection.start();
    return connection;
  },

  // Order room-ში შეყვანა (კლიენტი)
  joinOrder: async (orderId) => {
    if (!connection) await signalRService.connect();
    await connection.invoke('JoinOrder', String(orderId));
  },

  // Nurse room-ში შეყვანა (ექთანი)
  joinNurse: async (nurseId) => {
    if (!connection) await signalRService.connect();
    await connection.invoke('JoinNurse', String(nurseId));
  },

  // Event listener
  on: (event, callback) => {
    if (!connection) return;
    connection.on(event, callback);
  },

  off: (event, callback) => {
    if (!connection) return;
    connection.off(event, callback);
  },

  disconnect: async () => {
    if (connection) {
      await connection.stop();
      connection = null;
    }
  },

  getConnection: () => connection,
};
