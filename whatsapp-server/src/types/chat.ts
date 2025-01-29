export interface ChatMessage {
    id?: string;
    from: string;
    to?: string;
    body: string;
    timestamp: string;
    fromMe: boolean;
    isGroup: boolean;
    sender?: string;
}

export interface Chat {
    id?: string;
    phoneNumber: string;
    name: string;
    messages: ChatMessage[];
    lastMessage?: ChatMessage;
    createdAt?: string;
    updatedAt?: string;
}
