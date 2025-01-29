import React, { useRef, useEffect } from 'react';
import { MdSend, MdArrowBack } from 'react-icons/md';
import { Chat, WhatsAppMessage } from '../types/WhatsAppTypes';

interface ChatWindowProps {
    chat: Chat | undefined;
    message: string;
    setMessage: (message: string) => void;
    onSendMessage: () => void;
    onBack: () => void;
    isMobile: boolean;
}

const ChatWindow: React.FC<ChatWindowProps> = ({
    chat,
    message,
    setMessage,
    onSendMessage,
    onBack,
    isMobile
}) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [chat?.messages]);

    const formatTime = (timestamp: string) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    if (!chat) {
        return (
            <div className="hidden md:flex flex-1 items-center justify-center bg-[#f0f2f5]">
                <div className="text-center text-gray-500">
                    <h2 className="text-xl font-medium mb-2">WhatsApp Web</h2>
                    <p>Выберите чат для начала общения</p>
                </div>
            </div>
        );
    }

    return (
        <div className={`flex flex-col h-full ${isMobile && !chat ? 'hidden' : 'flex'} flex-1 bg-[#efeae2]`}>
            {/* Верхняя панель чата */}
            <div className="bg-[#f0f2f5] p-3 flex items-center gap-4">
                {isMobile && (
                    <button
                        onClick={onBack}
                        className="p-1 hover:bg-gray-200 rounded-full"
                    >
                        <MdArrowBack size={24} />
                    </button>
                )}
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-white">
                        {chat.name[0].toUpperCase()}
                    </div>
                    <div>
                        <div className="font-medium">{chat.name}</div>
                        <div className="text-sm text-gray-500">{chat.phoneNumber}</div>
                    </div>
                </div>
            </div>

            {/* Область сообщений */}
            <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-2">
                    {chat.messages.map((msg, index) => (
                        <div
                            key={index}
                            className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-[70%] p-2 rounded-lg ${
                                    msg.fromMe ? 'bg-[#d9fdd3]' : 'bg-white'
                                }`}
                            >
                                <div className="text-sm break-words">{msg.body}</div>
                                <div className="text-right">
                                    <span className="text-xs text-gray-500">
                                        {formatTime(msg.timestamp)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Панель ввода сообщения */}
            <div className="bg-[#f0f2f5] p-3">
                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && onSendMessage()}
                        placeholder="Введите сообщение"
                        className="flex-1 py-2 px-4 rounded-lg"
                    />
                    <button
                        onClick={onSendMessage}
                        disabled={!message.trim()}
                        className="p-2 bg-[#00a884] text-white rounded-full disabled:opacity-50"
                    >
                        <MdSend size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ChatWindow;
