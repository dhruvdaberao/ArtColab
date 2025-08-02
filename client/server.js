const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(express.static(__dirname));

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('joinRoom', (roomId) => {
        socket.join(roomId);
        socket.room = roomId;
        io.to(roomId).emit('roomJoined', roomId);
        console.log(`${socket.id} joined room ${roomId}`);
    });

    socket.on('draw', (data) => {
        socket.to(socket.room).emit('draw', data);
    });

    socket.on('clear', () => {
        socket.to(socket.room).emit('clear');
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        if (socket.room) {
            io.to(socket.room).emit('userLeft', socket.id);
        }
    });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});