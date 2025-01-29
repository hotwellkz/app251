import fs from 'fs';
import path from 'path';

const CHATS_FILE = path.join(__dirname, '../data/chats.json');

interface Message {
    from: string;
    to?: string;
    body: string;
    timestamp: string;
    isGroup: boolean;
    sender?: string;
    fromMe: boolean;
}

interface Chat {
    phoneNumber: string;
    name: string;
    messages: Message[];
    lastMessage?: Message;
}

// Убедимся, что директория существует
function ensureDirectoryExists() {
    const dir = path.dirname(CHATS_FILE);
    try {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
        }
        // Проверяем, существует ли файл
        if (!fs.existsSync(CHATS_FILE)) {
            fs.writeFileSync(CHATS_FILE, JSON.stringify({}), { mode: 0o644 });
        }
    } catch (error) {
        console.error('Error ensuring directory exists:', error);
        throw error;
    }
}

// Загрузка чатов из файла
export function loadChats(): { [key: string]: Chat } {
    try {
        ensureDirectoryExists();
        const data = fs.readFileSync(CHATS_FILE, 'utf-8');
        console.log('Loaded chats data:', data);
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading chats:', error);
        return {};
    }
}

// Сохранение чатов в файл
export function saveChats(chats: { [key: string]: Chat }) {
    try {
        ensureDirectoryExists();
        fs.writeFileSync(CHATS_FILE, JSON.stringify(chats, null, 2));
    } catch (error) {
        console.error('Error saving chats:', error);
        throw error;
    }
}

// Добавление нового сообщения
export function addMessage(message: Message): Chat {
    try {
        const chats = loadChats();
        const phoneNumber = message.fromMe ? message.to! : message.from;
        
        if (!chats[phoneNumber]) {
            chats[phoneNumber] = {
                phoneNumber,
                name: phoneNumber,
                messages: [],
                lastMessage: message
            };
        }
        
        chats[phoneNumber].messages.push(message);
        chats[phoneNumber].lastMessage = message;
        
        saveChats(chats);
        return chats[phoneNumber];
    } catch (error) {
        console.error('Error adding message:', error);
        throw error;
    }
}
