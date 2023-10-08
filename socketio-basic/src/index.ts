import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';

const app = express();
const server = createServer(app);
const port = 5000;
const io = new Server(server);
const dir = path.resolve();

app.get('/test', (req, res) => {
  console.log("Served '/test'");
  res.send('Hello, World!');
});

app.get('/', (req, res) => {
  res.sendFile(path.join(dir, './static/index.html'));
});

io.on('connection', (socket) => {
  console.log('A user connected');

  socket.broadcast.emit('chat message', '새로운 유저가 접속했습니다.');
  socket.emit('chat message', '채팅에 오신 것을 환영합니다.');

  socket.on('chat message', (msg) => {
    console.log(`message: ${msg}`);
    io.emit('chat message', msg);
  });

  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
});

server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
