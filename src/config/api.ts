<<<<<<< HEAD
// Определяем базовый URL API из переменных окружения
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
=======
// Определяем базовый URL API в зависимости от окружения
export const API_BASE_URL = process.env.NODE_ENV === 'production' 
    ? 'http://localhost:3000'  // Замените на URL вашего развернутого сервера
    : 'http://localhost:3000';
>>>>>>> b4ab11f7719434631ec461ca66864c7086a5a2bf

// Конфигурация для Socket.IO
export const SOCKET_CONFIG = {
    withCredentials: true,
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 20000
};
