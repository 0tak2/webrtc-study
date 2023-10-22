import express from 'express';
import { createServer } from 'https';
import { Server } from 'socket.io';
import fs from 'fs';
import { inspect } from 'util';
import 'dotenv/config';

const httpsOptions = {
  key: fs.readFileSync('./key.pem'),
  cert: fs.readFileSync('./cert.pem'),
};

const app = express();
const server = createServer(httpsOptions, app);
const port = 5000;
const io = new Server(server, {
  cors: {
    origin: [
      process.env.CORS_HOST_1,
      process.env.CORS_HOST_2,
      process.env.CORS_HOST_3,
    ],
  },
});

app.get('/test', (req, res) => {
  console.log("Served '/test'");
  res.send('Hello, World!<br>Server is healthy.');
});

const userListByRoom = {}; // 방 별 참여 유저 리스트가 저장되는 맵
const socketToRoom = {}; // 역방향으로 소켓을 키로 룸을 알 수 있는 맵

io.on('connection', (socket) => {
  console.log('A user connected: ', socket.id);

  socket.on('join_room', (data) => {
    if (userListByRoom[data.room]) {
      // 해당 룸에 참여한 유저가 있으면 현재 유저 추가
      userListByRoom[data.room].push({
        id: socket.id,
        username: data.username,
      });
    } else {
      // 없으면 현재 유저 정보를 포함시켜 새로 할당
      userListByRoom[data.room] = [
        {
          id: socket.id,
          username: data.username,
        },
      ];
    }

    socketToRoom[socket.id] = data.room;

    socket.join(data.room);
    console.log(
      `[${socketToRoom[socket.id]}]: New user (${socket.id}) entered.`,
    );

    io.sockets.to(socket.id).emit(
      'other_users',
      userListByRoom[data.room].filter((user) => user.id !== socket.id),
    );
  });

  socket.on('my_offer', (sdp) => {
    console.log(`Rceived a offer from ${socket.id}`);
    inspect(sdp);

    socket.broadcast.to(socketToRoom[socket.id]).emit('its_offer', sdp);
  });

  socket.on('my_answer', (sdp) => {
    console.log(`Rceived an answer from ${socket.id}`);
    inspect(sdp);

    socket.broadcast.to(socketToRoom[socket.id]).emit('its_answer', sdp);
  });

  socket.on('my_ice_candidate', (candidate) => {
    console.log(`Rceived an ICE candidate from ${socket.id}`);
    inspect(candidate);

    socket.broadcast
      .to(socketToRoom[socket.id])
      .emit('its_candidate', candidate);
  });

  socket.on('disconnect', () => {
    console.log(
      `[${socketToRoom[socket.id]}]: The user (${socket.id}) exited.`,
    );

    socket.broadcast
      .to(socketToRoom[socket.id])
      .emit('user_exit', { id: socket.id });

    const userListInRoom = userListByRoom[socketToRoom[socket.id]];
    if (userListByRoom[socketToRoom[socket.id]]) {
      userListByRoom[socketToRoom[socket.id]] = userListInRoom.filter(
        (user) => user.id !== socket.id,
      );
    }

    delete socketToRoom[socket.id];
  });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Server listening on port ${port}`);
});
