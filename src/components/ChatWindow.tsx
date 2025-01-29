import React, { useState } from 'react';
import { Chat } from '../types/WhatsAppTypes';
import { MdSend } from 'react-icons/md';

interface ChatWindowProps {
    chat: Chat;
    message: string;
    onMessageChange: (message: string) => void;
    onSendMessage: () => void;
    isReady: boolean;
}

const ChatWindow: React.FC<ChatWindowProps> = ({
    chat,
    message,
    onMessageChange,
    onSendMessage,
    isReady
}) => {
    const [showNotification, setShowNotification] = useState(false);

    const formatTime = (timestamp: string) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const handleSendMessage = () => {
        if (isReady && message.trim()) {
            onSendMessage();
            setShowNotification(true);
            setTimeout(() => setShowNotification(false), 2000);
        }
    };

    return (
        <div className="flex flex-col h-full relative">
            {/* Заголовок чата */}
            <div className="bg-[#f0f2f5] px-4 py-2 flex items-center border-l">
                <div className="flex items-center">
                    <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-white">
                        {chat.name[0].toUpperCase()}
                    </div>
                    <div className="ml-3">
                        <div className="font-medium">{chat.name}</div>
                        <div className="text-sm text-gray-500">
                            {chat.phoneNumber}
                        </div>
                    </div>
                </div>
            </div>

            {/* Область сообщений */}
            <div className="flex-1 overflow-y-auto p-4 bg-[#efeae2]">
                {chat.messages.map((msg, index) => (
                    <div
                        key={msg.id || index}
                        className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'} mb-2`}
                    >
                        <div
                            className={`max-w-[65%] rounded-lg p-2 ${
                                msg.fromMe ? 'bg-[#d9fdd3]' : 'bg-white'
                            }`}
                        >
                            <div className="text-sm break-words">{msg.body}</div>
                            <div className="text-[11px] text-gray-500 text-right mt-1">
                                {formatTime(msg.timestamp)}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Уведомление об отправке */}
            {showNotification && (
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                    <div className="bg-white px-6 py-3 rounded-lg shadow-lg">
                        <p className="text-gray-800">Подключено к серверу</p>
                    </div>
                </div>
            )}

            {/* Поле ввода */}
            <div className="bg-[#f0f2f5] p-3 border-t">
                <div className="flex items-center gap-2 bg-white rounded-lg px-4 py-2">
                    <textarea
                        value={message}
                        onChange={(e) => onMessageChange(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Введите сообщение"
                        className="flex-1 resize-none outline-none max-h-[100px] min-h-[24px]"
                        rows={1}
                    />
                    <button
                        onClick={handleSendMessage}
                        disabled={!isReady || !message.trim()}
                        className={`p-2 rounded-full ${
                            isReady && message.trim()
                                ? 'text-[#00a884] hover:bg-gray-100'
                                : 'text-gray-400 cursor-not-allowed'
                        }`}
                    >
                        <MdSend size={24} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ChatWindow;
