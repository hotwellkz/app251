import React, { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { WhatsAppMessage } from '../types/WhatsAppTypes';
import { useChat } from '../context/ChatContext';
import ChatList from './ChatList';
import ChatWindow from './ChatWindow';
import { API_BASE_URL, SOCKET_CONFIG } from '../config/api';
import { QRCodeSVG } from 'qrcode.react';

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

const WhatsAppConnect: React.FC<WhatsAppConnectProps> = () => {
    const { setQrCode } = useChat();
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isQrScanned, setIsQrScanned] = useState<boolean>(false);
    const [status, setStatus] = useState<string>('Подключение...');
    const [message, setMessage] = useState<string>('');
    const [chats, setChats] = useState<{ [key: string]: Chat }>({});
    const [activeChat, setActiveChat] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [qrCodeData, setQrCodeData] = useState<string | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [isReady, setIsReady] = useState<boolean>(false);

    useEffect(() => {
        const newSocket = io(API_BASE_URL, {
            ...SOCKET_CONFIG,
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });

        newSocket.on('connect', () => {
            console.log('Connected to server');
            setSocket(newSocket);
        });

        newSocket.on('disconnect', () => {
            console.log('Disconnected from server');
            setStatus('Отключено от сервера');
        });

        // Обработка QR-кода
        newSocket.on('whatsapp-qr', (qr: string) => {
            console.log('Received QR code');
            setQrCodeData(qr);
            setStatus('Отсканируйте QR-код');
        });

        // Обработка аутентификации
        newSocket.on('whatsapp-authenticated', () => {
            console.log('WhatsApp authenticated');
            setIsAuthenticated(true);
            setQrCodeData(null);
            setStatus('WhatsApp готов к работе');
        });

        // Обработка готовности
        newSocket.on('whatsapp-ready', () => {
            console.log('WhatsApp ready');
            setIsReady(true);
            setStatus('WhatsApp готов к работе');
        });

        // Обработка отключения WhatsApp (не сокета)
        newSocket.on('whatsapp-disconnected', (reason: string) => {
            console.log('WhatsApp disconnected:', reason);
            setIsAuthenticated(false);
            setIsReady(false);
            setStatus('WhatsApp отключен: ' + reason);
        });

        // Обработка входящих сообщений
        newSocket.on('whatsapp-message', (message: WhatsAppMessage) => {
            console.log('Received message:', message);
            setChats(prevChats => {
                const chatId = message.fromMe ? message.to! : message.from;
                const existingChat = prevChats[chatId] || {
                    phoneNumber: chatId,
                    name: chatId.split('@')[0],
                    messages: [],
                    unreadCount: 0
                };

                return {
                    ...prevChats,
                    [chatId]: {
                        ...existingChat,
                        messages: [...existingChat.messages, message],
                        lastMessage: message
                    }
                };
            });
        });

        setSocket(newSocket);

        // Очистка при размонтировании
        return () => {
            if (newSocket) {
                newSocket.removeAllListeners();
                newSocket.close();
            }
        };
    }, []); // Запускаем эффект только один раз при монтировании

    const handleSendMessage = async () => {
        if (!activeChat || !message || !isReady) return;

        try {
            const response = await fetch(`${API_BASE_URL}/send-message`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    phoneNumber: activeChat,
                    message: message
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Ошибка при отправке сообщения');
            }

            // Очищаем поле сообщения только после успешной отправки
            setMessage('');
        } catch (error) {
            console.error('Ошибка при отправке сообщения:', error);
            setStatus('Ошибка при отправке сообщения');
        }
    };

    const handleConnect = () => {
        // Implement handleConnect logic here
    };

    return (
        <div className="flex flex-col h-screen bg-[#f0f2f5]">
            {/* Верхняя панель */}
            <div className="bg-[#00a884] text-white p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="font-medium">WhatsApp Web</span>
                </div>
                <div className="flex items-center gap-4">
                    {!isAuthenticated && (
                        <button 
                            onClick={handleConnect}
                            className="px-4 py-2 bg-white/10 rounded hover:bg-white/20 transition-colors"
                        >
                            Подключиться
                        </button>
                    )}
                </div>
            </div>

            {/* Основной контент */}
            <div className="flex-1 flex">
                {!isAuthenticated ? (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center">
                            <div className="qr-container bg-white p-8 rounded-lg shadow-lg">
                                <h2 className="text-xl font-medium mb-4">{status}</h2>
                                {qrCodeData && (
                                    <QRCodeSVG value={qrCodeData} size={256} level="H" />
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex">
                        <div className="flex h-full w-full max-w-[1600px] mx-auto shadow-lg">
                            {/* Список чатов */}
                            <div className="w-[400px] bg-white border-r">
                                <ChatList
                                    chats={chats}
                                    activeChat={activeChat}
                                    setActiveChat={(chatId: string) => setActiveChat(chatId)}
                                    searchQuery={searchQuery}
                                    setSearchQuery={(query: string) => setSearchQuery(query)}
                                    onNewChat={() => {}}
                                    isMobile={window.innerWidth < 768}
                                />
                            </div>

                            {/* Окно чата или заглушка */}
                            <div className="flex-1 bg-[#f0f2f5] relative">
                                {activeChat ? (
                                    <ChatWindow
                                        chat={chats[activeChat]}
                                        message={message}
                                        onMessageChange={setMessage}
                                        onSendMessage={handleSendMessage}
                                        isReady={isReady}
                                    />
                                ) : (
                                    <div className="h-full flex items-center justify-center text-center text-gray-500">
                                        <div>
                                            <h2 className="text-2xl font-light mb-2">WhatsApp Web</h2>
                                            <p>Выберите чат для начала общения</p>
                                        </div>
                                    </div>
                                )}

                                {/* Боковые кнопки */}
                                <div className="absolute right-4 top-20 flex flex-col gap-4 z-50">
                                    <button className="w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center text-gray-600 hover:bg-gray-100">
                                        <svg viewBox="0 0 24 24" width="24" height="24">
                                            <path fill="currentColor" d="M19.005 3.175H4.674C3.642 3.175 3 3.789 3 4.821V21.02l3.544-3.514h12.461c1.033 0 2.064-1.06 2.064-2.093V4.821c-.001-1.032-1.032-1.646-2.064-1.646zm-4.989 9.869H7.041V11.1h6.975v1.944zm3-4H7.041V7.1h9.975v1.944z"></path>
                                        </svg>
                                    </button>
                                    <button className="w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center text-gray-600 hover:bg-gray-100">
                                        <svg viewBox="0 0 24 24" width="24" height="24">
                                            <path fill="currentColor" d="M12 20.664a9.163 9.163 0 0 1-6.521-2.702.977.977 0 0 1 1.381-1.381 7.269 7.269 0 0 0 10.024.244.977.977 0 0 1 1.313 1.445A9.192 9.192 0 0 1 12 20.664zm7.965-6.112a.977.977 0 0 1-.944-1.229 7.26 7.26 0 0 0-4.8-8.804.977.977 0 0 1 .594-1.86 9.212 9.212 0 0 1 6.092 11.169.976.976 0 0 1-.942.724zm-16.025-.39a.977.977 0 0 1-.953-.769 9.21 9.21 0 0 1 6.626-10.86.975.975 0 1 1 .52 1.882l-.015.004a7.259 7.259 0 0 0-5.223 8.558.978.978 0 0 1-.955 1.185z"></path>
                                        </svg>
                                    </button>
                                    <button className="w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center text-gray-600 hover:bg-gray-100">
                                        <svg viewBox="0 0 24 24" width="24" height="24">
                                            <path fill="currentColor" d="M12 7a2 2 0 1 0-.001-4.001A2 2 0 0 0 12 7zm0 2a2 2 0 1 0-.001 3.999A2 2 0 0 0 12 9zm0 6a2 2 0 1 0-.001 3.999A2 2 0 0 0 12 15z"></path>
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WhatsAppConnect;
