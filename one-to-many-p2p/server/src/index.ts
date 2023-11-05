import express from 'express';
import { createServer } from 'https';
import { Server } from 'socket.io';
import fs from 'fs';
import { inspect } from 'util';
import 'dotenv/config';

interface JoinPayload {
  room: string;
  username: string;
}

interface OfferPayload {
  sdp: any;
  senderUsername: string;
  senderId: string;
  receiverUsername: string;
  receiverId: string;
}

interface IcePayload {
  candidate: any;
  senderUsername: string;
  senderId: string;
  receiverUsername: string;
  receiverId: string;
}

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
const MAX_USERS_PER_ROOM = process.env.MAX_USERS_PER_ROOM || 4;

io.on('connection', (socket) => {
  console.log('A user connected: ', socket.id);

  socket.on('join_room', (data: JoinPayload) => {
    if (userListByRoom[data.room]) {
      // 현재 참여자 수 확인
      if (userListByRoom[data.room].length === MAX_USERS_PER_ROOM) {
        socket.emit("room_full");
        console.log(
          `New user (${socket.id}) tried to enter but too many users in the room: ${data.room}`,
        );
        return;
      }

      // 해당 룸에 참여한 유저가 있으면 (할당된 유저 배열이 있으면) 현재 유저 추가
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
      'user_list',
      userListByRoom[data.room],
    );
  });

  socket.on('submit_offer', (data: OfferPayload) => {
    console.log(`Rceived a offer from ${data.senderId} to ${data.receiverId}`);
    inspect(data.sdp);

    socket.to(data.receiverId).emit('get_offer', data);
  });

  socket.on('submit_answer', (data: OfferPayload) => {
    console.log(`Rceived an answer from ${data.senderId} to ${data.receiverId}`);
    inspect(data.sdp);

    socket.to(data.receiverId).emit('get_answer', data);
  });

  socket.on('submit_ice_candidate', (data: IcePayload) => {
    console.log(`Rceived an ICE candidate from ${data.senderId} to ${data.receiverId}`);
    inspect(data.candidate);

    socket.to(data.receiverId).emit('get_ice_candidate', data);
  });

  socket.on('disconnect', () => {
    const roomId = socketToRoom[socket.id];

    console.log(
      `[${roomId}]: The user (${socket.id}) exited.`,
    );

    let userList = userListByRoom[roomId];
    if (userList) {
      userList = userList.filter(
        (user) => user.id !== socket.id,
      );

      if (userList.length === 0) { // 마지막 유저가 나간 경우 메시지를 발송하지 않고 종료
        delete userListByRoom[roomId];
        return;
      }
    }

    socket.broadcast
    .to(roomId)
    .emit('user_exit', { id: socket.id });
  });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Server listening on port ${port}`);
});
