import fs from 'fs';
import path from 'path';
import { ChatMessage, Chat } from '../types/chat';

const CHATS_FILE = path.join(__dirname, '../data/chats.json');

// Убедимся, что директория существует
function ensureDirectoryExists() {
    const dir = path.dirname(CHATS_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(CHATS_FILE)) {
        fs.writeFileSync(CHATS_FILE, JSON.stringify({}));
    }
}

// Загрузка чатов из файла
export function loadChats(): { [key: string]: Chat } {
    try {
        ensureDirectoryExists();
        const data = fs.readFileSync(CHATS_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading chats:', error);
        return {};
    }
}

// Сохранение чатов в файл
export function saveChats(chats: { [key: string]: Chat }): void {
    try {
        ensureDirectoryExists();
        fs.writeFileSync(CHATS_FILE, JSON.stringify(chats, null, 2));
    } catch (error) {
        console.error('Error saving chats:', error);
    }
}

// Добавление нового сообщения
export function addMessage(message: ChatMessage): Chat {
    const chats = loadChats();
    const chatId = message.fromMe ? message.to! : message.from;
    
    // Создаем новый чат, если его нет
    if (!chats[chatId]) {
        chats[chatId] = {
            phoneNumber: chatId,
            name: chatId.split('@')[0],
            messages: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
    }

    // Добавляем сообщение в чат
    chats[chatId].messages.push(message);
    chats[chatId].lastMessage = message;
    chats[chatId].updatedAt = new Date().toISOString();

    // Сохраняем обновленные чаты
    saveChats(chats);

    return chats[chatId];
}
