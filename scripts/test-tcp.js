
import net from 'net';
import tls from 'tls';

const HOST = 'db.pvrlnclgogftwqirgvkh.supabase.co';
const PORT = 5432;

console.log(`Testing TCP connection to ${HOST}:${PORT}...`);

const socket = new net.Socket();

socket.setTimeout(5000);

socket.on('connect', () => {
    console.log('TCP Connection successful!');
    socket.destroy();
});

socket.on('timeout', () => {
    console.error('TCP Connection timed out!');
    socket.destroy();
});

socket.on('error', (err) => {
    console.error('TCP Connection error:', err.message);
});

socket.connect(PORT, HOST);
