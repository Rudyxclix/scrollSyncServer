const express = require('express');
const http = require('http');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');

// App setup
const app = express();
const server = http.createServer(app);
const PORT = 5000;

// WebSocket setup
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// In-memory mapping of roomId → file URL (with persistence)
const DB_PATH = 'roomMap.json';
let roomToFileMap = {};

if (fs.existsSync(DB_PATH)) {
    roomToFileMap = JSON.parse(fs.readFileSync(DB_PATH));
}

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// File upload config
const storage = multer.diskStorage({
    destination: 'uploads/',
    filename: (_, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage });

// Upload PDF and store mapping
app.post('/upload', upload.single('file'), (req, res) => {
    const roomId = req.body.roomId;
    const fileUrl = `http://localhost:${PORT}/uploads/${req.file.filename}`;
    roomToFileMap[roomId] = fileUrl;
    fs.writeFileSync(DB_PATH, JSON.stringify(roomToFileMap, null, 2));
    res.json({ fileUrl });
});

// Get PDF by roomId
app.get('/room-file/:roomId', (req, res) => {
    const fileUrl = roomToFileMap[req.params.roomId];
    if (fileUrl) {
        res.json({ fileUrl });
    } else {
        res.status(404).json({ error: 'File not found for this room ID' });
    }
});

// WebSocket events
io.on('connection', (socket) => {
    socket.on('join-room', (roomId) => {
        socket.join(roomId);
    });

    socket.on('scroll-sync', ({ roomId, scrollTop }) => {
        socket.to(roomId).emit('scroll-update', scrollTop);
    });
});

server.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});
