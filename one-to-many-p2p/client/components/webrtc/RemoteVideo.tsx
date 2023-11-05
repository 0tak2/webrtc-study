import { useEffect, useRef } from "react";

interface Props {
    username: string;
    stream: MediaStream;
}

export default function RemoteVideo({ username, stream }: Props) {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
        }
    })

    return (
        <div>
            <video
                ref={videoRef}
                autoPlay
                playsInline
            >
            </video>
            <div>
                <span>{username}</span>
            </div>
        </div>
    )
}