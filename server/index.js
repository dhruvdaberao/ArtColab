// server/index.js
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const rooms = {};

io.on('connection', socket => {
  let room;
  socket.on('joinRoom', data => {
    room = data.room;
    socket.join(room);
    rooms[room] = rooms[room] || [];
    // track users
    rooms[room] = rooms[room].filter(u => u.userId !== data.userId);
    rooms[room].push({ userId: data.userId, avatar: data.avatar });
    io.to(room).emit('updateMembers', rooms[room]);
  });

  socket.on('draw', pts => io.to(room).emit('draw', pts));
  socket.on('endStroke', () => io.to(room).emit('endStroke'));
  socket.on('undo', () => io.to(room).emit('undo'));
  socket.on('redo', () => io.to(room).emit('redo'));
  socket.on('clear', () => io.to(room).emit('clear'));

  socket.on('leaveRoom', userId => {
    rooms[room] = rooms[room].filter(u => u.userId !== userId);
    io.to(room).emit('updateMembers', rooms[room]);
  });

  socket.on('disconnect', () => {
    if (room) {
      rooms[room] = rooms[room].filter(u => u.userId !== socket.id);
      io.to(room).emit('updateMembers', rooms[room]);
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server on port ${PORT}`));
