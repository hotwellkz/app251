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
        'https://2wix.ru',
        'https://your-netlify-site.netlify.app'
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
            'https://2wix.ru',
            'https://your-netlify-site.netlify.app'
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

// Добавляем обработчик ошибок для клиента
client.on('disconnected', (reason) => {
    console.log('Client was logged out', reason);
    // Попытка переподключения
    setTimeout(() => {
        client.initialize();
    }, 5000);
});

// Добавляем обработчик для отслеживания состояния подключения
let clientReady = false;
client.on('ready', () => {
    clientReady = true;
    console.log('Client is ready!');
});

client.on('auth_failure', () => {
    clientReady = false;
    console.log('Auth failure, restarting...');
});

// Функция для проверки готовности клиента
const isClientReady = () => {
    return clientReady && client.pupPage && client.pupBrowser;
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

// API для отправки сообщений
app.post('/send-message', async (req, res) => {
    try {
        const { phoneNumber, message } = req.body;

        if (!phoneNumber || !message) {
            return res.status(400).json({ 
                success: false, 
                error: 'Необходимо указать номер телефона и текст сообщения' 
            });
        }

        // Проверяем готовность клиента
        if (!isClientReady()) {
            return res.status(503).json({
                success: false,
                error: 'WhatsApp клиент не готов. Пожалуйста, подождите или отсканируйте QR-код заново'
            });
        }

        console.log('Отправка сообщения:', { phoneNumber, message });

        // Форматируем номер телефона
        const formattedNumber = phoneNumber.includes('@c.us') 
            ? phoneNumber 
            : `${phoneNumber.replace(/[^\d]/g, '')}@c.us`;

        // Проверяем, зарегистрирован ли номер в WhatsApp
        try {
            const isRegistered = await client.isRegisteredUser(formattedNumber);
            if (!isRegistered) {
                return res.status(404).json({
                    success: false,
                    error: 'Номер не зарегистрирован в WhatsApp'
                });
            }
        } catch (error) {
            console.error('Ошибка при проверке номера:', error);
            return res.status(500).json({
                success: false,
                error: 'Ошибка при проверке номера в WhatsApp'
            });
        }

        // Отправляем сообщение
        const response = await client.sendMessage(formattedNumber, message);
        console.log('Сообщение отправлено:', response);

        // Создаем и сохраняем сообщение локально
        const sentMessage: ChatMessage = {
            id: response.id.id,
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
        console.error('Ошибка при отправке сообщения:', error);
        
        // Если клиент отключился, пытаемся переинициализировать
        if (!isClientReady()) {
            try {
                await client.initialize();
            } catch (initError) {
                console.error('Ошибка при переинициализации клиента:', initError);
            }
        }
        
        res.status(500).json({ 
            success: false, 
            error: error instanceof Error ? error.message : 'Ошибка при отправке сообщения'
        });
    }
});

const port = 3000;

// Запуск сервера
httpServer.listen(port, () => {
    console.log(`Сервер запущен на порту ${port}`);
    
    // Инициализируем хранилище чатов
    try {
        const chats = loadChats();
        console.log('Chat storage initialized successfully');
    } catch (error) {
        console.error('Error initializing chat storage:', error);
    }
    
    // Инициализация WhatsApp клиента
    client.initialize()
        .catch(error => console.error('Ошибка при инициализации WhatsApp клиента:', error));
});
