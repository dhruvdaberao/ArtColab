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


// const express = require('express');
// const http = require('http');
// const socketIO = require('socket.io');

// const app = express();
// const server = http.createServer(app);
// const io = socketIO(server, {
//     cors: { origin: "*", methods: ["GET", "POST"] }
// });

// const rooms = {}; // Store points per room

// app.use(express.static(__dirname));

// io.on('connection', (socket) => {
//     console.log('A user connected:', socket.id);

//     socket.on('joinRoom', (roomId) => {
//         if (rooms[roomId] && Object.keys(io.sockets.adapter.rooms.get(roomId) || {}).length > 0) {
//             socket.emit('roomExists', 'Room name already in use. Please choose another.');
//             return;
//         }
//         socket.leaveAll(); // Leave any previous rooms
//         socket.join(roomId);
//         socket.room = roomId;
//         if (!rooms[roomId]) rooms[roomId] = []; // Initialize room points
//         socket.emit('initialState', rooms[roomId]); // Send current state to new user
//         io.to(roomId).emit('updateUsers', Object.keys(io.sockets.adapter.rooms.get(roomId) || {}).length);
//         console.log(`${socket.id} joined room ${roomId}`);
//     });

//     socket.on('draw', (point) => {
//         if (socket.room && rooms[socket.room]) {
//             rooms[socket.room].push(point);
//             socket.to(socket.room).emit('draw', point); // Broadcast to others
//         }
//     });

//     socket.on('clearRoom', () => {
//         if (socket.room && rooms[socket.room]) {
//             rooms[socket.room] = []; // Reset room points
//             io.to(socket.room).emit('clearRoom'); // Broadcast clear to all
//         }
//     });

//     socket.on('disconnect', () => {
//         console.log('User disconnected:', socket.id);
//         if (socket.room) {
//             io.to(socket.room).emit('updateUsers', Object.keys(io.sockets.adapter.rooms.get(roomId) || {}).length - 1);
//         }
//     });
// });

// const PORT = process.env.PORT || 8080;
// server.listen(PORT, () => {
//     console.log(`Server running on port ${PORT}`);
// });