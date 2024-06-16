import net from 'net';
import tls from 'tls';
const KEEP_ALIVE_DELAY = 60000;

// @ts-ignore
export default ({ host, port }) => {
    // @ts-ignore
    return ({ ssl,  onConnect }): tls.TLSSocket | net.Socket => {
        const socket = ssl ? tls.connect(Object.assign({ host, port }, ssl), onConnect) : net.connect({ host, port }, onConnect)
        socket.setKeepAlive(true, KEEP_ALIVE_DELAY);
        return socket;
    }
}