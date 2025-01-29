import React, { useState } from 'react';
import WhatsAppConnect from './WhatsAppConnect';
import WhatsAppQRCode from './WhatsAppQRCode';
import { useChat } from '../context/ChatContext';
import { MdQrCode2, MdPersonAdd } from 'react-icons/md';

const WhatsAppContent: React.FC = () => {
    const [showQRCode, setShowQRCode] = useState(false);
    const [showNewContact, setShowNewContact] = useState(false);
    const [phoneNumber, setPhoneNumber] = useState('');
    const { createChat } = useChat();

    const handleCreateContact = async () => {
        if (!phoneNumber) return;
        
        // Форматируем номер телефона (убираем все кроме цифр)
        const formattedNumber = phoneNumber.replace(/\D/g, '');
        
        try {
            await createChat(formattedNumber);
            setShowNewContact(false);
            setPhoneNumber('');
        } catch (error) {
            console.error('Error creating chat:', error);
        }
    };

    return (
        <div className="h-screen bg-[#f0f2f5] relative flex flex-col">
            {/* Верхняя панель */}
            <div className="w-full bg-[#00a884] px-4 py-2 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <span className="text-white hidden md:inline">Подключено к серверу</span>
                    <div 
                        className="cursor-pointer flex items-center gap-2 text-white"
                        onClick={() => setShowQRCode(true)}
                    >
                        <MdQrCode2 className="w-6 h-6" />
                        <span className="text-sm hidden md:inline">Сканировать QR-код</span>
                    </div>
                    <div 
                        className="cursor-pointer flex items-center gap-2 text-white"
                        onClick={() => setShowNewContact(true)}
                    >
                        <MdPersonAdd className="w-6 h-6" />
                        <span className="text-sm hidden md:inline">Новый контакт</span>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-hidden">
                <WhatsAppConnect serverUrl="http://localhost:3000" />
            </div>

            {/* Модальные окна */}
            {showQRCode && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg p-6 relative max-w-md w-full">
                        <button 
                            className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
                            onClick={() => setShowQRCode(false)}
                        >
                            ✕
                        </button>
                        <WhatsAppQRCode />
                    </div>
                </div>
            )}

            {showNewContact && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg p-6 relative max-w-md w-full">
                        <button 
                            className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
                            onClick={() => {
                                setShowNewContact(false);
                                setPhoneNumber('');
                            }}
                        >
                            ✕
                        </button>
                        <h2 className="text-xl font-semibold mb-4">Новый контакт</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">
                                    Номер телефона
                                </label>
                                <input
                                    type="tel"
                                    value={phoneNumber}
                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                    placeholder="Например: +7 777 123 45 67"
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                                />
                            </div>
                            <button
                                onClick={handleCreateContact}
                                className="w-full bg-[#00a884] text-white rounded-md py-2 hover:bg-[#008f6c]"
                            >
                                Создать чат
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WhatsAppContent;
