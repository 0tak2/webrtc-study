import { useState, useRef, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import './meeting-container.css';
import RemoteVideo from './RemoteVideo';

interface UserInfo {
    id: string;
    username: string;
}

interface UserAndStream {
    id: string;
    username: string;
    stream: MediaStream;
}

interface UserAndPc {
    [id: string]: RTCPeerConnection
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

const pcConfig = {
    iceServers: [
        {
            urls: 'stun:stun.l.google.com:19302',
        },
    ]
}

export default function MeetingContainer() {
    const [inputs, setInputs] = useState({
        room: '',
        username: '',
    })
    const [users, setUsers] = useState<Array<UserAndStream>>([]);

    const pcs: UserAndPc = {};
    let localStream: MediaStream;
    let socketRef = useRef<Socket>();
    let localVideoRef = useRef<HTMLVideoElement>(null);

    // On the component mounted
    useEffect(() => {
        initWebRTC();

        // Clean up
        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
        };
    }, []);

    const initWebRTC = () => {
        socketRef.current = io(process.env.NEXT_PUBLIC_WEB_SOCKET_HOST
            ? process.env.NEXT_PUBLIC_WEB_SOCKET_HOST
            : 'https://localhost:5000');

        socketRef.current.on('room_full', () => {
            console.warn(`room_full: ${inputs.room}`);
            alert(`현재 ${inputs.room} 룸에 최대 인원이 접속해있어 접속할 수 없습니다.`);
        });
        
        socketRef.current.on('user_list', (userList: Array<UserInfo>) => {
            console.log('Received other users list: ', userList);
            userList.forEach(user => {
                if (socketRef.current &&
                    user.id === socketRef.current.id) return;

                createPc(user.id, user.username);

                const pc: RTCPeerConnection = pcs[user.id];

                createOffer(pc, user.id);
            });
        });

        socketRef.current.on('get_offer', (data: OfferPayload) => {
            console.log('Received other user\'s offer: ', data);
            createAnswer(data);
        });

        socketRef.current.on('get_answer', (data: OfferPayload) => {
            console.log('Received other user\'s answer: ', data);
            pcs[data.senderId].setRemoteDescription(new RTCSessionDescription(data.sdp));
        });

        socketRef.current.on('get_ice_candidate', (data: IcePayload) => {
            pcs[data.senderId].addIceCandidate(new RTCIceCandidate(data.candidate))
            .then(() => {
                console.log('New ICE candidate added: ', data);
            });
        });

        socketRef.current.on("user_exit", (data: { id: string }) => {
            pcs[data.id].close();
            delete pcs[data.id];
            setUsers(oldUsers => oldUsers.filter(user => user.id !== data.id));
        });

        console.log('Ready to connect');
        console.log('My socket: ', socketRef.current);
    }

    const handleConnectBtn = () => {
        navigator.mediaDevices
            .getUserMedia({
                video: true,
                audio: true,
            })
            .then((stream) => {
                if (!socketRef.current) return;

                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                }

                localStream = stream;

                socketRef.current.emit('join_room', {
                    room: inputs.room,
                    username: inputs.username,
                })
            })
            .catch((err) => {
                console.error('Error on getUserMedia: ', err);
            });
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;

        setInputs({
            ...inputs,
            [name]: value,
        });
    }

    const createOffer = (pc: RTCPeerConnection, receiverId: string) => {
    
        pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true })
            .then(sdp => {
                if (!socketRef.current) return;
                pc.setLocalDescription(new RTCSessionDescription(sdp));
                socketRef.current.emit('submit_offer', {
                    sdp,
                    senderId: socketRef.current.id,
                    senderUsername: inputs.username,
                    receiverId
                });
                console.log('Sent my SDP offer');
            })
            .catch((err) => {
                console.error("Error on creating an offer: ", err);
            });
    };

    const createAnswer = (offer: OfferPayload) => {
        const pc: RTCPeerConnection = pcs[offer.senderId];
        console.log('[createAnswer] current pcs: ', pcs);
        console.log('[createAnswer] offer: ', offer);
        

        pc.setRemoteDescription(new RTCSessionDescription(offer.sdp))
            .then(() => {
                pc.createAnswer({ offerToReceiveAudio: true, offerToReceiveVideo: true })
                    .then(sdp => {
                        if (!pc || !socketRef.current) return;
                        pc.setLocalDescription(new RTCSessionDescription(sdp));
                        socketRef.current.emit('submit_answer', {
                            sdp,
                            senderUsername: inputs.username,
                            senderId: socketRef.current.id,
                            receiverUsername: offer.senderUsername,
                            receiverId: offer.senderId,
                        });
                        console.log('Sent my SDP answer');
                    })
                    .catch((err) => {
                        console.error("Error on creating an answer: ", err);
                    })
            })
    };

    const createPc = (receiverId: string, receiverUsername: string) => {
        const pc = new RTCPeerConnection(pcConfig);

        pcs[receiverId] = pc;

        console.log('[createPc] current pcs: ', pcs);

        pc.onicecandidate = (event) => {
            if (!socketRef.current || !event.candidate) return;
            console.log('onicecandidate');
            socketRef.current.emit('submit_ice_candidate', {
                candidate: event.candidate,
                senderUsername: inputs.username,
                senderId: socketRef.current.id,
                receiverUsername: receiverUsername,
                receiverId: receiverId,
            });
        };

        pc.oniceconnectionstatechange = (event) => {
            console.log('oniceconnectionstatechange: ', event);
        };

        pc.ontrack = (event) => {
            console.log('ontrack');

            // 해당 ID의 유저가 저장되어 있는 경우 제외해준다
            setUsers(oldUsers => oldUsers.filter(user => user.id !== receiverId));

            setUsers(oldUsers => [
                ...oldUsers,
                {
                    id: receiverId,
                    username: receiverUsername,
                    stream: event.streams[0],
                }
            ]);

            if (localStream) {
                localStream.getTracks().forEach(track => {
                    pc.addTrack(track, localStream);
                })
                console.log('successfully add track to pc: ', pc);
            } else {
                console.error('no local stream error on adding track to pc: ', pc);
                
            }
        };
    }

    return (
        <div>
            <div>
                <input name='room' placeholder='방이름' onChange={handleInputChange} />
                <input name='username' placeholder='닉네임' onChange={handleInputChange} />
                <button onClick={handleConnectBtn}>연결</button>
            </div>

            <div>
                <ul>
                    <li>
                        방이름: {inputs.room}
                    </li>
                    <li>
                        닉네임: {inputs.username}
                    </li>
                </ul>
            </div>

            <video
                muted
                ref={localVideoRef}
                autoPlay
                playsInline
            ></video>

            {users.map((UserAndStream, idx) => (
                    <>asdfasdf
                    <RemoteVideo
                        key={idx}
                        username={UserAndStream.username}
                        stream={UserAndStream.stream} />
                        </>
            ))}
        </div>
    )
}