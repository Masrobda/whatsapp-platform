// src/socket.js
const socketIO = require('socket.io');
const { verify } = require('jsonwebtoken');
const { query } = require('./config/database');

let io;

function initSocket(server) {
  io = new socketIO.Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true,
    },
    path: '/socket.io/',
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('Authentication error'));
      const decoded = verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const clientId = socket.user.id;
    socket.join(`client-${clientId}`);

    socket.on('disconnect', () => {});
  });
}

function emitToClient(clientId, event, data) {
  if (!io) return;
  io.to(`client-${clientId}`).emit(event, data);
}

module.exports = { initSocket, emitToClient };
