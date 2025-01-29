import React, { useState } from 'react';
import { ChatProvider } from '../context/ChatContext';
import WhatsAppContent from '../components/WhatsAppContent';

const WhatsApp: React.FC = () => {
    return (
        <ChatProvider>
            <WhatsAppContent />
        </ChatProvider>
    );
};

export default WhatsApp;