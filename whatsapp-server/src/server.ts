import express from 'express';
import { Client, LocalAuth, Message } from 'whatsapp-web.js';
import { Server } from 'socket.io';
import { createServer } from 'http';
import cors from 'cors';
import qrcode from 'qrcode';
import fs from 'fs';
import { loadChats, addMessage } from './utils/chatStorage';
import { ChatMessage, Chat } from './types/chat';

const app = express();
const httpServer = createServer(app);

// Настройка CORS для Express
const corsOptions = {
    origin: [
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:4173',  // Vite preview port
        'http://localhost:4174'   // Vite preview alternative port
    ],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept'],
    credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

// Настройка Socket.IO с CORS
const io = new Server(httpServer, {
    cors: {
        origin: [
            'http://localhost:5173',
            'http://localhost:5174',
            'http://localhost:4173',  // Vite preview port
            'http://localhost:4174'   // Vite preview alternative port
        ],
        methods: ["GET", "POST"],
        credentials: true
    },
    pingTimeout: 60000
});

// Инициализация WhatsApp клиента
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ],
        defaultViewport: {
            width: 1280,
            height: 720
        }
    }
});

let qrCode: string | null = null;
let clientReady = false;

// Обработчик QR кода
client.on('qr', (qr) => {
    console.log('QR Code received:', qr);
    qrCode = qr;
    io.emit('whatsapp-qr', qr);
});

// Обработчик успешной аутентификации
client.on('authenticated', () => {
    console.log('Client is authenticated!');
    qrCode = null;
    io.emit('whatsapp-authenticated');
});

// Обработчик готовности клиента
client.on('ready', () => {
    clientReady = true;
    console.log('WhatsApp client is ready!');
    qrCode = null;
    io.emit('whatsapp-ready');
});

// Обработчик отключения
client.on('disconnected', (reason) => {
    console.log('Client was disconnected:', reason);
    clientReady = false;
    qrCode = null;
    io.emit('whatsapp-disconnected', reason);

    // Попытка переподключения через 5 секунд
    setTimeout(async () => {
        console.log('Attempting to reinitialize client...');
        try {
            await client.initialize();
        } catch (error) {
            console.error('Failed to reinitialize client:', error);
            io.emit('whatsapp-error', 'Failed to reinitialize client');
        }
    }, 5000);
});

// Добавляем обработчик ошибок для клиента
client.on('disconnected', (reason) => {
    console.log('Client was logged out. Reason:', reason);
    clientReady = false;
    // Попытка переподключения
    setTimeout(() => {
        console.log('Attempting to reinitialize client...');
        client.initialize().catch(err => {
            console.error('Failed to reinitialize client:', err);
        });
    }, 5000);
});

// Добавляем обработчик для отслеживания состояния подключения
client.on('ready', () => {
    clientReady = true;
    console.log('WhatsApp client is ready and fully authenticated!');
});

client.on('auth_failure', (msg) => {
    clientReady = false;
    console.log('Authentication failure:', msg);
});

client.on('authenticated', () => {
    console.log('Client is authenticated!');
});

client.on('loading_screen', (percent, message) => {
    console.log('Loading screen:', percent, '%', message);
});

// Функция для проверки готовности клиента
const isClientReady = () => {
    const ready = clientReady && client.pupPage && client.pupBrowser;
    console.log('Client ready status:', {
        clientReady,
        pupPage: !!client.pupPage,
        pupBrowser: !!client.pupBrowser,
        overallReady: ready
    });
    return ready;
};

// API endpoint для получения сохраненных чатов
app.get('/chats', (req, res) => {
    console.log('GET /chats запрос получен');
    try {
        const chats = loadChats();
        console.log('Чаты загружены:', chats);
        res.json(chats);
    } catch (error) {
        console.error('Ошибка при загрузке чатов:', error);
        res.status(500).json({ error: 'Failed to load chats' });
    }
});

// API endpoint для создания нового чата
app.post('/chat', async (req, res) => {
    try {
        const { phoneNumber } = req.body;

        if (!phoneNumber) {
            return res.status(400).json({ 
                success: false, 
                error: 'Необходимо указать номер телефона' 
            });
        }

        // Форматируем номер телефона
        const formattedNumber = phoneNumber.includes('@c.us') 
            ? phoneNumber 
            : `${phoneNumber.replace(/[^\d]/g, '')}@c.us`;

        // Проверяем существование контакта в WhatsApp
        const contactExists = await client.isRegisteredUser(formattedNumber);
        
        if (!contactExists) {
            return res.status(404).json({ 
                success: false, 
                error: 'Номер не зарегистрирован в WhatsApp' 
            });
        }

        // Получаем информацию о контакте
        const contact = await client.getContactById(formattedNumber);
        
        // Создаем новый чат
        const newChat: Chat = {
            phoneNumber: formattedNumber,
            name: contact.pushname || phoneNumber,
            messages: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Добавляем чат в хранилище
        const chats = loadChats();
        chats[formattedNumber] = newChat;
        
        // Сохраняем обновленные чаты
        fs.writeFileSync('./src/data/chats.json', JSON.stringify(chats, null, 2));

        // Оповещаем всех клиентов о новом чате
        io.emit('chat-created', newChat);

        res.json({ 
            success: true, 
            chat: newChat
        });
    } catch (error) {
        console.error('Ошибка при создании чата:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка при создании чата' 
        });
    }
});

// API для отправки сообщений
app.post('/send-message', async (req, res) => {
    try {
        const { phoneNumber, message } = req.body;
        console.log('Received send message request:', { phoneNumber, message });

        if (!phoneNumber || !message) {
            console.log('Missing required fields');
            return res.status(400).json({ 
                success: false, 
                error: 'Необходимо указать номер телефона и текст сообщения' 
            });
        }

        // Проверяем готовность клиента
        if (!isClientReady()) {
            console.log('Client is not ready');
            return res.status(503).json({
                success: false,
                error: 'WhatsApp клиент не готов. Пожалуйста, подождите или отсканируйте QR-код заново'
            });
        }

        console.log('Client is ready, proceeding with message send');

        // Форматируем номер телефона
        const formattedNumber = phoneNumber.includes('@c.us') 
            ? phoneNumber 
            : `${phoneNumber.replace(/[^\d]/g, '')}@c.us`;

        console.log('Formatted phone number:', formattedNumber);

        // Проверяем, зарегистрирован ли номер в WhatsApp
        try {
            console.log('Checking if number is registered...');
            const isRegistered = await client.isRegisteredUser(formattedNumber);
            console.log('Number registration status:', isRegistered);
            
            if (!isRegistered) {
                return res.status(404).json({
                    success: false,
                    error: 'Номер не зарегистрирован в WhatsApp'
                });
            }
        } catch (error) {
            console.error('Error checking number registration:', error);
            return res.status(500).json({
                success: false,
                error: 'Ошибка при проверке номера в WhatsApp'
            });
        }

        // Отправляем сообщение
        console.log('Sending message...');
        const response = await client.sendMessage(formattedNumber, message);
        console.log('Message sent successfully:', response);

        // Создаем и сохраняем сообщение локально
        const sentMessage: ChatMessage = {
            id: response.id.id, // Добавляем ID сообщения
            from: 'me',
            to: formattedNumber,
            body: message,
            timestamp: new Date().toISOString(),
            isGroup: false,
            fromMe: true
        };

        const updatedChat = addMessage(sentMessage);

        // Отправляем обновление всем клиентам
        io.emit('whatsapp-message', sentMessage);
        io.emit('chat-updated', updatedChat);

        res.json({ 
            success: true, 
            message: 'Сообщение отправлено успешно',
            messageId: response.id.id
        });
    } catch (error) {
        console.error('Error sending message:', error);
        
        // Если клиент отключился, пытаемся переинициализировать
        if (!isClientReady()) {
            console.log('Client disconnected, attempting to reinitialize...');
            try {
                await client.initialize();
            } catch (initError) {
                console.error('Error reinitializing client:', initError);
            }
        }
        
        res.status(500).json({ 
            success: false, 
            error: error instanceof Error ? error.message : 'Ошибка при отправке сообщения'
        });
    }
});

// Эндпоинт для проверки статуса
app.get('/whatsapp-status', (req, res) => {
    res.json({
        ready: clientReady,
        qrCode: qrCode,
        authenticated: client.pupPage !== null
    });
});

// Обработка socket.io подключений
io.on('connection', (socket) => {
    console.log('Новое Socket.IO подключение');
    
    // Отправляем текущие чаты при подключении
    try {
        const chats = loadChats();
        socket.emit('chats', chats);
    } catch (error) {
        console.error('Ошибка при отправке чатов через сокет:', error);
    }

    // Отправляем текущий статус при подключении
    socket.emit('whatsapp-status', {
        ready: clientReady,
        qrCode: qrCode,
        authenticated: client.pupPage !== null
    });

    socket.on('disconnect', () => {
        console.log('Socket.IO клиент отключился');
    });
});

// Обработчики событий WhatsApp
client.on('qr', async (qr) => {
    try {
        const qrCode = await qrcode.toDataURL(qr);
        io.emit('qr', qrCode.split(',')[1]);
    } catch (error) {
        console.error('Error generating QR code:', error);
    }
});

client.on('ready', () => {
    console.log('WhatsApp клиент готов');
    io.emit('ready');
});

client.on('authenticated', () => {
    console.log('WhatsApp аутентифицирован');
    io.emit('authenticated');
});

client.on('auth_failure', (msg) => {
    console.error('Ошибка аутентификации:', msg);
    io.emit('auth_failure', msg);
});

client.on('disconnected', (reason) => {
    console.log('WhatsApp отключен:', reason);
    io.emit('disconnected', reason);
});

// Обработка входящих сообщений
client.on('message', async (message: Message) => {
    try {
        const chat = await message.getChat();
        const contact = await message.getContact();
        
        const whatsappMessage: ChatMessage = {
            id: message.id.id, // Добавляем ID сообщения
            from: message.from,
            to: message.to,
            body: message.body,
            timestamp: new Date(message.timestamp * 1000).toISOString(),
            isGroup: chat.isGroup,
            fromMe: message.fromMe,
            sender: chat.isGroup ? contact.pushname || contact.number : undefined
        };

        console.log('Получено новое сообщение:', whatsappMessage);

        // Сохраняем сообщение локально
        const updatedChat = addMessage(whatsappMessage);
        
        // Отправляем обновление всем клиентам
        io.emit('whatsapp-message', whatsappMessage);
        io.emit('chat-updated', updatedChat);

        console.log('Сообщение обработано и отправлено клиентам');
    } catch (error) {
        console.error('Ошибка при обработке сообщения:', error);
    }
});

const port = 3000;

// Запуск сервера
httpServer.listen(port, () => {
    console.log(`Server is running on port ${port}`);
    
    // Инициализируем хранилище чатов
    try {
        const chats = loadChats();
        console.log('Chat storage initialized successfully');
    } catch (error) {
        console.error('Error initializing chat storage:', error);
    }
    
    // Инициализация WhatsApp клиента
    console.log('Initializing WhatsApp client...');
    client.initialize()
        .then(() => {
            console.log('WhatsApp client initialized successfully');
        })
        .catch(error => {
            console.error('Error initializing WhatsApp client:', error);
        });
});
