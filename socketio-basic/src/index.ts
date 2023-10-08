import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';

interface UserInfo {
  id: string;
  nickname: string;
  joinDt: Date;
}

const app = express();
const server = createServer(app);
const port = 5000;
const io = new Server(server);
const dir = path.resolve();
let users: UserInfo[] = [];

function findUserBySocketId(socketId: string) {
  return users.find((el) => el.id === socketId);
}

app.get('/test', (req, res) => {
  console.log("Served '/test'");
  res.send('Hello, World!');
});

app.get('/', (req, res) => {
  res.sendFile(path.join(dir, './static/index.html'));
});

io.on('connection', (socket) => {
  console.log('A user connected: ', socket.id);

  socket.emit('system', '채팅에 오신 것을 환영합니다.');

  socket.on('join', (nickname) => {
    const newUser = {
      id: socket.id,
      nickname,
      joinDt: new Date(),
    };

    users.push(newUser);

    socket.broadcast.emit('join', {
      new: newUser,
      users,
    });
  });

  socket.on('chat message', (message) => {
    io.emit('chat message', {
      message,
      from: findUserBySocketId(socket.id),
    });
  });

  socket.on('disconnect', () => {
    users = users.filter((el) => el.id !== socket.id);
    console.log('user disconnected');
  });
});

server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
