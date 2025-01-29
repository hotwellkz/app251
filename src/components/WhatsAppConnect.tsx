import React, { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { WhatsAppMessage } from '../types/WhatsAppTypes';
import { useChat } from '../context/ChatContext';

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
        <div className="flex h-screen bg-[#f0f2f5]">
            {/* Боковая панель */}
            <div className="w-[30%] min-w-[300px] border-r border-[#d1d7db] bg-white flex flex-col">
                {/* Заголовок с профилем */}
                <div className="h-[60px] bg-[#f0f2f5] px-4 flex items-center justify-between">
                    <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
                            <span className="text-gray-600">
                                {status === 'WhatsApp подключен' ? '✓' : '?'}
                            </span>
                        </div>
                        <div className="ml-3">
                            <div className="text-sm text-gray-600">{status}</div>
                        </div>
                    </div>
                </div>

                {/* Поиск */}
                <div className="px-4 py-2">
                    <input
                        type="text"
                        placeholder="Поиск или новый чат"
                        className="w-full px-4 py-2 bg-[#f0f2f5] rounded-lg"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                {/* Список чатов */}
                <div className="flex-1 overflow-y-auto">
                    {filteredChats.map((chat) => (
                        <div
                            key={chat.phoneNumber}
                            className={`flex items-center px-4 py-3 cursor-pointer hover:bg-[#f0f2f5] ${
                                activeChat === chat.phoneNumber ? 'bg-[#f0f2f5]' : ''
                            }`}
                            onClick={() => {
                                setActiveChat(chat.phoneNumber);
                                resetUnreadCount(chat.phoneNumber);
                            }}
                        >
                            <div className="w-12 h-12 rounded-full bg-gray-300 flex-shrink-0 flex items-center justify-center">
                                <span className="text-gray-600">
                                    {chat.name[0].toUpperCase()}
                                </span>
                            </div>
                            <div className="ml-4 flex-1 min-w-0">
                                <div className="flex justify-between items-baseline">
                                    <h3 className="text-base font-medium text-gray-900 truncate">
                                        {formatPhoneNumber(chat.phoneNumber)}
                                    </h3>
                                    <div className="flex items-center">
                                        {chat.unreadCount > 0 && (
                                            <span className="bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs mr-2">
                                                {chat.unreadCount}
                                            </span>
                                        )}
                                        {chat.lastMessage && (
                                            <span className="text-xs text-gray-500">
                                                {new Date(chat.lastMessage.timestamp).toLocaleTimeString()}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {chat.lastMessage && (
                                    <p className="text-sm text-gray-500 truncate">
                                        {chat.lastMessage.body}
                                    </p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Основная область чата */}
            <div className="flex-1 flex flex-col">
                {activeChat ? (
                    <>
                        {/* Заголовок чата */}
                        <div className="h-[60px] bg-[#f0f2f5] px-4 flex items-center">
                            <div className="w-10 h-10 rounded-full bg-gray-300 flex-shrink-0 flex items-center justify-center">
                                <span className="text-gray-600">
                                    {chats[activeChat]?.name[0].toUpperCase()}
                                </span>
                            </div>
                            <div className="ml-4">
                                <h2 className="text-base font-medium text-gray-900">
                                    {chats[activeChat]?.name}
                                </h2>
                            </div>
                        </div>

                        {/* Область сообщений */}
                        <div className="flex-1 overflow-y-auto bg-[#efeae2] p-4">
                            {activeChatMessages.map((msg, index) => (
                                <div
                                    key={index}
                                    className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'} mb-4`}
                                >
                                    <div
                                        className={`max-w-[60%] p-3 rounded-lg ${
                                            msg.fromMe ? 'bg-[#d9fdd3]' : 'bg-white'
                                        }`}
                                    >
                                        <p className="text-sm">{msg.body}</p>
                                        <div className="text-right">
                                            <span className="text-xs text-gray-500">
                                                {new Date(msg.timestamp).toLocaleTimeString()}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Поле ввода */}
                        <div className="h-[60px] bg-[#f0f2f5] px-4 flex items-center">
                            <input
                                type="text"
                                placeholder="Введите сообщение"
                                className="flex-1 px-4 py-2 rounded-lg mr-4"
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                onKeyPress={(e) => {
                                    if (e.key === 'Enter') {
                                        handleSendMessage();
                                    }
                                }}
                            />
                            <button
                                onClick={handleSendMessage}
                                className="px-4 py-2 bg-[#00a884] text-white rounded-lg"
                            >
                                Отправить
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center">
                        <p className="text-gray-600">
                            Выберите чат для начала общения
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WhatsAppConnect;
