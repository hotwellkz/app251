import React, { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { WhatsAppMessage } from '../types/WhatsAppTypes';
import { useChat } from '../context/ChatContext';
import ChatList from './ChatList';
import ChatWindow from './ChatWindow';

interface WhatsAppConnectProps {
    serverUrl: string;
}

interface Chat {
    phoneNumber: string;
    name: string;
    lastMessage?: WhatsAppMessage;
    messages: WhatsAppMessage[];
    unreadCount: number;
}

const WhatsAppConnect: React.FC<WhatsAppConnectProps> = ({ serverUrl }) => {
    const { setQrCode } = useChat();
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isQrScanned, setIsQrScanned] = useState<boolean>(false);
    const [status, setStatus] = useState<string>('Подключение...');
    const [message, setMessage] = useState<string>('');
    const [chats, setChats] = useState<{ [key: string]: Chat }>({});
    const [activeChat, setActiveChat] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState<string>('');

    // Функция для форматирования номера телефона
    const formatPhoneNumber = (phoneNumber: string) => {
        return phoneNumber.replace(/@[a-z.]+$/i, '');
    };

    // Функция для добавления сообщения в чат
    const addMessageToChat = (message: WhatsAppMessage) => {
        const phoneNumber = message.fromMe ? message.to! : message.from;
        
        setChats(prevChats => {
            const updatedChats = { ...prevChats };
            if (!updatedChats[phoneNumber]) {
                updatedChats[phoneNumber] = {
                    phoneNumber,
                    name: message.sender || formatPhoneNumber(phoneNumber),
                    messages: [],
                    unreadCount: 0
                };
            }

            const messageExists = updatedChats[phoneNumber].messages.some(
                existingMsg => 
                    existingMsg.body === message.body && 
                    existingMsg.fromMe === message.fromMe &&
                    Math.abs(new Date(existingMsg.timestamp).getTime() - new Date(message.timestamp).getTime()) < 1000
            );

            if (!messageExists) {
                updatedChats[phoneNumber].messages = [...updatedChats[phoneNumber].messages, message];
                updatedChats[phoneNumber].lastMessage = message;
                // Увеличиваем счетчик непрочитанных сообщений только для входящих сообщений
                if (!message.fromMe) {
                    updatedChats[phoneNumber].unreadCount += 1;
                }
            }

            return updatedChats;
        });
    };

    // Функция для сброса счетчика непрочитанных сообщений
    const resetUnreadCount = (phoneNumber: string) => {
        setChats(prevChats => ({
            ...prevChats,
            [phoneNumber]: {
                ...prevChats[phoneNumber],
                unreadCount: 0
            }
        }));
    };

    useEffect(() => {
        const newSocket = io('http://localhost:3000', {
            withCredentials: true
        });

        newSocket.on('connect', () => {
            setStatus('Подключено к серверу');
        });

        newSocket.on('qr', (qrData: string) => {
            console.log('Получен QR-код, длина:', qrData.length);
            try {
                // Пытаемся распарсить данные, если они в формате JSON
                const parsedData = JSON.parse(qrData);
                console.log('QR данные в формате JSON:', parsedData);
                
                // Если это объект, берем только нужные поля
                if (typeof parsedData === 'object') {
                    const qrString = parsedData.code || parsedData.qr || parsedData.data || qrData;
                    console.log('Извлеченная строка QR:', qrString);
                    setQrCode(qrString);
                } else {
                    setQrCode(qrData);
                }
            } catch (e) {
                // Если это не JSON, используем как есть
                console.log('QR данные в обычном формате:', qrData);
                setQrCode(qrData);
            }
            
            setIsQrScanned(false);
            setStatus('Ожидание сканирования QR-кода');
        });

        newSocket.on('ready', () => {
            console.log('WhatsApp готов');
            setStatus('WhatsApp подключен');
            setIsQrScanned(true);
            setQrCode('');
        });

        newSocket.on('whatsapp-message', (message: WhatsAppMessage) => {
            console.log('Получено новое сообщение:', message);
            addMessageToChat(message);
        });

        // Обработка обновления чата
        newSocket.on('chat-updated', (updatedChat: Chat) => {
            console.log('Получено обновление чата:', updatedChat);
            setChats(prevChats => ({
                ...prevChats,
                [updatedChat.phoneNumber]: updatedChat
            }));
        });

        newSocket.on('disconnected', () => {
            console.log('WhatsApp отключен');
            setStatus('WhatsApp отключен');
            setIsQrScanned(false);
            setQrCode(''); // Очищаем QR-код
        });

        newSocket.on('auth_failure', (error: string) => {
            console.error('Ошибка аутентификации:', error);
            setStatus(`Ошибка: ${error}`);
        });

        setSocket(newSocket);

        // Загружаем историю чатов при подключении
        fetch('http://localhost:3000/chats', {
            credentials: 'include'
        })
            .then(response => response.json())
            .then(chatsData => {
                console.log('Загружены чаты:', chatsData);
                setChats(chatsData);
            })
            .catch(error => {
                console.error('Ошибка при загрузке чатов:', error);
            });

        return () => {
            newSocket.close();
        };
    }, [setQrCode]);

    const handleSendMessage = async () => {
        if (!activeChat || !message) return;

        try {
            const response = await fetch('http://localhost:3000/send-message', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    phoneNumber: activeChat,
                    message,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Ошибка при отправке сообщения');
            }

            // Очищаем поле ввода только после успешной отправки
            setMessage('');
        } catch (error) {
            console.error('Ошибка при отправке сообщения:', error);
            alert('Ошибка при отправке сообщения: ' + error);
        }
    };

    const filteredChats = Object.values(chats).filter(chat => 
        chat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        chat.phoneNumber.includes(searchQuery)
    );

    const activeChatMessages = activeChat ? chats[activeChat]?.messages || [] : [];

    return (
        <div className="flex h-full">
            <ChatList
                chats={chats}
                activeChat={activeChat}
                setActiveChat={(chatId) => {
                    setActiveChat(chatId);
                    if (chats[chatId]) {
                        resetUnreadCount(chatId);
                    }
                }}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                onNewChat={() => {}} // Добавьте обработчик для создания нового чата
                isMobile={window.innerWidth < 768}
            />
            
            <ChatWindow
                chat={activeChat ? chats[activeChat] : undefined}
                message={message}
                setMessage={setMessage}
                onSendMessage={handleSendMessage}
                onBack={() => setActiveChat(null)}
                isMobile={window.innerWidth < 768}
            />
        </div>
    );
};

export default WhatsAppConnect;
