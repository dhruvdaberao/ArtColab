// const express = require('express');
// const http = require('http');
// const socketIO = require('socket.io');

// const app = express();
// const server = http.createServer(app);
// const io = socketIO(server, {
//     cors: {
//         origin: "*",
//         methods: ["GET", "POST"]
//     }
// });

// app.use(express.static(__dirname));

// io.on('connection', (socket) => {
//     console.log('A user connected:', socket.id);

//     socket.on('joinRoom', (roomId) => {
//         socket.join(roomId);
//         socket.room = roomId;
//         io.to(roomId).emit('roomJoined', roomId);
//         console.log(`${socket.id} joined room ${roomId}`);
//     });

//     socket.on('draw', (data) => {
//         socket.to(socket.room).emit('draw', data);
//     });

//     socket.on('clear', () => {
//         socket.to(socket.room).emit('clear');
//     });

//     socket.on('disconnect', () => {
//         console.log('User disconnected:', socket.id);
//         if (socket.room) {
//             io.to(socket.room).emit('userLeft', socket.id);
//         }
//     });
// });

// const PORT = process.env.PORT || 8080;
// server.listen(PORT, () => {
//     console.log(`Server running on port ${PORT}`);
// });



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
        io.to(roomId).emit('updateUsers', Object.keys(io.sockets.adapter.rooms.get(roomId) || {}).length);
        console.log(`${socket.id} joined room ${roomId}`);
    });

    socket.on('draw', (data) => {
        socket.to(socket.room).emit('draw', data); // Broadcast to others in the room
    });

    socket.on('clearSelf', (userId) => {
        socket.to(socket.room).emit('clearOther', { userId, room: socket.room }); // Notify others to clear this user's drawings
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        if (socket.room) {
            io.to(socket.room).emit('userLeft', socket.id);
            io.to(socket.room).emit('updateUsers', Object.keys(io.sockets.adapter.rooms.get(socket.room) || {}).length - 1);
        }
    });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});