// Поскольку мы сейчас используем локальное хранение,
// этот файл нужен только для совместимости
export const supabase = {
    from: () => ({
        select: () => ({
            or: () => ({
                order: () => Promise.resolve({ data: [], error: null })
            })
        })
    })
};
