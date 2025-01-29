// Определяем базовый URL API в зависимости от окружения
export const API_BASE_URL = process.env.NODE_ENV === 'production' 
    ? 'http://localhost:3000'  // Замените на URL вашего развернутого сервера
    : 'http://localhost:3000';

// Конфигурация для Socket.IO
export const SOCKET_CONFIG = {
    withCredentials: true,
    transports: ['websocket', 'polling']
};
