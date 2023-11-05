# 1:N P2P WebRTC 미팅 예제 

여러 클라이언트가 직접 WebRTC로 스트림을 교환하는 예제 프론트엔드

대부분의 코드는 [여기](https://millo-l.github.io/WebRTC-%EA%B5%AC%ED%98%84%ED%95%98%EA%B8%B0-1-N-P2P/)를 참고해서 작성했습니다.

## Getting Started

1. https 인증서 준비

https를 위한 인증서를 만들어 프론트엔드 프로젝트 루트에 위치시킵니다.  
개발 서버를 띄우기 위해서는 아래와 같이 [mkcert](https://github.com/FiloSottile/mkcert)를 통해 개발용 인증서를 만들 수 있습니다.

```bash
mkcert -install

# 로컬호스트로 테스트하기 위해서는 아래의 커맨드를 실행합니다.
mkcert -key-file key.pem -cert-file cert.pem localhost 127.0.0.1 ::1

# 사설 아이피로 테스트하기 위해서는 다음과 같이 연결할 호스트를 추가해 실행합니다.
mkcert -key-file key.pem -cert-file cert.pem localhost 127.0.0.1 ::1 192.168.1.74
```

2. 웹소켓 서버 호스트 지정

프로젝트 루트의 .env.local.example를 .env.local로 복사하고, 서버의 호스트를 입력하여 저장합니다.

3. 개발 서버 시작

프로젝트 루트에서 다음을 실행하여 개발 서버를 시작합니다.

```bash
npm install
npm run devs
```

[https://localhost:3001/webrtc](https://localhost:3001/webrtc) 또는 https://{1에서 추가로 지정한 아이피 주소}:3001/webrtc를 브라우저에서 엽니다.