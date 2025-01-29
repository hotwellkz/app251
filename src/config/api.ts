// Определяем базовый URL API из переменных окружения
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Конфигурация для Socket.IO
export const SOCKET_CONFIG = {
    withCredentials: true,
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 20000
};
