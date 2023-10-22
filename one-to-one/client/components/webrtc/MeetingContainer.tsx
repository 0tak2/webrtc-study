import { useState, useRef, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import './meeting-container.css';


export default function MeetingContainer() {
    const [inputs, setInputs] = useState({
        room: '',
        username: '',
    })

    let pcRef = useRef<RTCPeerConnection>();
    let socketRef = useRef<Socket>();
    let localVideoRef = useRef<HTMLVideoElement>(null);
    let remoteVideoRef = useRef<HTMLVideoElement>(null);

    // On the component mounted
    useEffect(() => {
        initWebRTC();

        // Clean up
        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
            if (pcRef.current) {
                pcRef.current.close();
            }
        };
    }, []);

    const initWebRTC = () => {
        socketRef.current = io(process.env.NEXT_PUBLIC_WEB_SOCKET_HOST
            ? process.env.NEXT_PUBLIC_WEB_SOCKET_HOST
            : 'https://localhost:5000');
        pcRef.current = new RTCPeerConnection({
            iceServers: [
                {
                    urls: 'stun:stun.l.google.com:19302',
                },
            ]
        });

        socketRef.current.on('other_users', (otherUsers) => {
            if (otherUsers.length <= 0) {
                return;
            }
            console.log('Received other users list');
            createOffer();
        });

        socketRef.current.on('its_offer', (sdp: RTCSessionDescription) => {
            console.log('Received other user\'s offer: ', sdp);
            createAnswer(sdp);
        });

        socketRef.current.on('its_answer', (sdp: RTCSessionDescription) => {
            if (!pcRef.current) return;

            console.log('Received other user\'s answer: ', sdp);
            pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp))
        });

        socketRef.current.on('its_candidate', (candidate: RTCIceCandidateInit) => {
            if (!pcRef.current) return;

            pcRef.current.addIceCandidate(new RTCIceCandidate(candidate))
                .then(() => {
                    console.log('New ICE candidate added: ', candidate);
                })
        });

        console.log('Ready to connect');
    }

    const handleConnectBtn = () => {
        navigator.mediaDevices
            .getUserMedia({
                video: true,
                audio: true,
            })
            .then((stream) => {
                if (!pcRef.current || !socketRef.current) return;

                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                }

                stream.getTracks().forEach((track) => {
                    if (!pcRef.current) return;
                    pcRef.current.addTrack(track, stream);
                    console.log('Added atrack to pc: ', track);
                });

                pcRef.current.onicecandidate = (event) => {
                    if (!socketRef.current) return;
                    if (event.candidate) {
                        console.log('onicecandidate');
                        socketRef.current.emit('my_ice_candidate', event.candidate);
                    }
                };

                pcRef.current.oniceconnectionstatechange = (event) => {
                    console.log('oniceconnectionstatechange: ', event);
                };

                pcRef.current.ontrack = (event) => {
                    console.log('ontrack');
                    if (remoteVideoRef.current) {
                        console.log(event.streams);
                        remoteVideoRef.current.srcObject = event.streams[0];
                    }
                };

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

    const createOffer = () => {
        if (!pcRef.current || !socketRef.current) return;

        pcRef.current.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true })
            .then(sdp => {
                if (!pcRef.current || !socketRef.current) return;
                pcRef.current.setLocalDescription(new RTCSessionDescription(sdp));
                socketRef.current.emit('my_offer', sdp);
                console.log('Sent my SDP offer');
            })
            .catch((err) => {
                console.error("Error on creating an offer: ", err);
            });
    };

    const createAnswer = (sdp: RTCSessionDescription) => {
        if (!pcRef.current || !socketRef.current) return;

        pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp))
            .then(() => {
                if (!pcRef.current) return;
                pcRef.current.createAnswer({ offerToReceiveAudio: true, offerToReceiveVideo: true })
                    .then(answer => {
                        if (!pcRef.current || !socketRef.current) return;
                        pcRef.current.setLocalDescription(new RTCSessionDescription(answer));
                        socketRef.current.emit('my_answer', answer);
                        console.log('Sent my SDP answer');
                    })
                    .catch((err) => {
                        console.error("Error on creating an answer: ", err);
                    })
            })
    };

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

            <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
            >
            </video>
        </div>
    )
}