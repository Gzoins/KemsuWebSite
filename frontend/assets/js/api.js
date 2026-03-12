// api.js - API клиент для взаимодействия с новым backend
// Заменяет localStorage на реальные API вызовы

const API_BASE = 'http://localhost:4001/api';
const TOKEN_KEY = 'kemgu_token';

console.log('[API] Script loaded');
console.log('[API] API_BASE:', API_BASE);

// Получение токена из localStorage
function getAuthToken() {
    return localStorage.getItem(TOKEN_KEY);
}

// Установка токена в localStorage
function setAuthToken(token) {
    if (token) {
        localStorage.setItem(TOKEN_KEY, token);
    } else {
        localStorage.removeItem(TOKEN_KEY);
    }
}

// Удаление токена
function clearAuthToken() {
    localStorage.removeItem(TOKEN_KEY);
}

// Функция для создания заголовков с авторизацией
function getAuthHeaders() {
    const token = getAuthToken();
    return {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
    };
}

// Базовая функция для API запросов
async function apiRequest(url, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    const token = getAuthToken();
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
        headers,
        ...options
    };

    try {
        const response = await fetch(url, config);
        
        if (!response.ok) {
            if (response.status === 401) {
                // Токен недействителен, очищаем и перенаправляем на вход
                clearAuthToken();
                if (window.location.pathname !== '/index.html') {
                    window.location.href = 'index.html';
                }
                throw new Error('Требуется авторизация');
            }
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        }
        
        return response;
    } catch (error) {
        console.error('API Request Error:', error);
        throw error;
    }
}

// Аутентификация
const authAPI = {
    // Регистрация
    async register(userData) {
        return await apiRequest(`${API_BASE}/auth/register/register`, {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    },

    // Подтверждение email кодом
    async verifyEmail(verificationData) {
        return await apiRequest(`${API_BASE}/auth/register/verify-email`, {
            method: 'POST',
            body: JSON.stringify(verificationData)
        });
    },

    // Повторная отправка кода подтверждения
    async resendVerificationCode(emailData) {
        return await apiRequest(`${API_BASE}/auth/register/resend-verification`, {
            method: 'POST',
            body: JSON.stringify(emailData)
        });
    },

    // Авторизация
    async login(credentials) {
        const result = await apiRequest(`${API_BASE}/auth/login/login`, {
            method: 'POST',
            body: JSON.stringify(credentials)
        });
        
        if (result.token) {
            setAuthToken(result.token);
        }
        
        return result;
    },

    // Получение профиля
    async getProfile() {
        return await apiRequest(`${API_BASE}/login/me`);
    },

    // Обновление профиля
    async updateProfile(profileData) {
        return await apiRequest(`${API_BASE}/login/profile`, {
            method: 'PUT',
            body: JSON.stringify(profileData)
        });
    },

    // Смена пароля
    async changePassword(passwordData) {
        return await apiRequest(`${API_BASE}/login/change-password`, {
            method: 'PUT',
            body: JSON.stringify(passwordData)
        });
    },

    // Выход
    logout() {
        clearAuthToken();
    }
};

// Администрирование
const adminAPI = {
    // Получение списка пользователей
    async getUsers(params = {}) {
        const url = new URL(`${API_BASE}/admin/users`);
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
        return await apiRequest(url.toString());
    },

    // Получение пользователя по ID
    async getUserById(id) {
        return await apiRequest(`${API_BASE}/admin/users/${id}`);
    },

    // Создание пользователя
    async createUser(userData) {
        return await apiRequest(`${API_BASE}/admin/users`, {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    },

    // Обновление пользователя
    async updateUser(id, userData) {
        return await apiRequest(`${API_BASE}/admin/users/${id}`, {
            method: 'PUT',
            body: JSON.stringify(userData)
        });
    },

    // Удаление пользователя
    async deleteUser(id) {
        return await apiRequest(`${API_BASE}/admin/users/${id}`, {
            method: 'DELETE'
        });
    },

    // Получение статистики
    async getStats() {
        return await apiRequest(`${API_BASE}/admin/stats`);
    }
};

// Лекции
const lectureAPI = {
    // Получение списка лекций
    async getLectures(params = {}) {
        const url = new URL(`${API_BASE}/lectures`);
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
        return await apiRequest(url.toString());
    },

    // Получение лекции по ID
    async getLectureById(id) {
        return await apiRequest(`${API_BASE}/lectures/${id}`);
    },

    // Создание лекции
    async createLecture(lectureData) {
        return await apiRequest(`${API_BASE}/lectures`, {
            method: 'POST',
            body: JSON.stringify(lectureData)
        });
    },

    // Обновление лекции
    async updateLecture(id, lectureData) {
        return await apiRequest(`${API_BASE}/lectures/${id}`, {
            method: 'PUT',
            body: JSON.stringify(lectureData)
        });
    },

    // Удаление лекции
    async deleteLecture(id) {
        return await apiRequest(`${API_BASE}/lectures/${id}`, {
            method: 'DELETE'
        });
    }
};

// Задания
const assignmentAPI = {
    // Получение списка заданий
    async getAssignments(params = {}) {
        const url = new URL(`${API_BASE}/assignments`);
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
        return await apiRequest(url.toString());
    },

    // Получение задания по ID
    async getAssignmentById(id) {
        return await apiRequest(`${API_BASE}/assignments/${id}`);
    },

    // Создание задания
    async createAssignment(assignmentData) {
        return await apiRequest(`${API_BASE}/assignments`, {
            method: 'POST',
            body: JSON.stringify(assignmentData)
        });
    },

    // Обновление задания
    async updateAssignment(id, assignmentData) {
        return await apiRequest(`${API_BASE}/assignments/${id}`, {
            method: 'PUT',
            body: JSON.stringify(assignmentData)
        });
    },

    // Удаление задания
    async deleteAssignment(id) {
        return await apiRequest(`${API_BASE}/assignments/${id}`, {
            method: 'DELETE'
        });
    }
};

// Учебные материалы
const resourceAPI = {
    // Получение списка материалов
    async getResources(params = {}) {
        const url = new URL(`${API_BASE}/resources`);
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
        return await apiRequest(url.toString());
    },

    // Получение материала по ID
    async getResourceById(id) {
        return await apiRequest(`${API_BASE}/resources/${id}`);
    },

    // Загрузка материала (с файлом)
    async createResource(resourceData, file) {
        const formData = new FormData();
        
        // Добавляем текстовые поля
        Object.keys(resourceData).forEach(key => {
            if (resourceData[key]) {
                formData.append(key, resourceData[key]);
            }
        });
        
        // Добавляем файл
        if (file) {
            formData.append('file', file);
        }

        return await apiRequest(`${API_BASE}/resources`, {
            method: 'POST',
            body: formData,
            headers: {} // Не устанавливаем Content-Type для FormData
        });
    },

    // Обновление материала
    async updateResource(id, resourceData) {
        return await apiRequest(`${API_BASE}/resources/${id}`, {
            method: 'PUT',
            body: JSON.stringify(resourceData)
        });
    },

    // Удаление материала
    async deleteResource(id) {
        return await apiRequest(`${API_BASE}/resources/${id}`, {
            method: 'DELETE'
        });
    }
};

// Сабмиты
const submissionAPI = {
    // Получение списка сабмитов
    async getSubmissions(params = {}) {
        const url = new URL(`${API_BASE}/submissions`);
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
        return await apiRequest(url.toString());
    },

    // Получение сабмита по ID
    async getSubmissionById(id) {
        return await apiRequest(`${API_BASE}/submissions/${id}`);
    },

    // Создание сабмита (загрузка работы)
    async createSubmission(submissionData, file) {
        const formData = new FormData();
        
        // Добавляем текстовые поля
        Object.keys(submissionData).forEach(key => {
            if (submissionData[key]) {
                formData.append(key, submissionData[key]);
            }
        });
        
        // Добавляем файл
        if (file) {
            formData.append('file', file);
        }

        return await apiRequest(`${API_BASE}/submissions`, {
            method: 'POST',
            body: formData,
            headers: {} // Не устанавливаем Content-Type, чтобы браузер сам определил boundary
        });
    },

    // Обновление сабмита (оценка)
    async updateSubmission(id, submissionData) {
        return await apiRequest(`${API_BASE}/submissions/${id}`, {
            method: 'PUT',
            body: JSON.stringify(submissionData)
        });
    },

    // Удаление сабмита
    async deleteSubmission(id) {
        return await apiRequest(`${API_BASE}/submissions/${id}`, {
            method: 'DELETE'
        });
    }
};

// Экспорт API
console.log('[API] Exporting kemguAPI');
window.kemguAPI = {
    auth: authAPI,
    admin: adminAPI,
    lectures: lectureAPI,
    assignments: assignmentAPI,
    resources: resourceAPI,
    getAuthToken,
    setAuthToken,
    clearAuthToken
};
console.log('[API] kemguAPI exported:', window.kemguAPI);
console.log('[API] kemguAPI.auth:', window.kemguAPI.auth);

// Совместимость со старым кодом
window.fetchDB = async function() {
    try {
        const profile = await authAPI.getProfile();
        return {
            user: profile,
            isAuthenticated: true
        };
    } catch (error) {
        return {
            user: null,
            isAuthenticated: false
        };
    }
};

window.saveDBUnified = async function(db) {
    // Для совместимости - просто возвращаем true
    return true;
};

window.uploadSubmissionFile = async function({ assignmentId, studentLogin, fileInput }) {
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        throw new Error('No file selected');
    }

    const file = fileInput.files[0];
    const submissionData = {
        assignment_id: assignmentId,
        work_title: file.name,
        comment: ''
    };

    try {
        const result = await submissionAPI.createSubmission(submissionData, file);
        return result;
    } catch (error) {
        console.error('Upload error:', error);
        throw error;
    }
};

window.setSession = function(user) {
    if (user && user.token) {
        setAuthToken(user.token);
    }
};

window.getSession = function() {
    const token = getAuthToken();
    console.log('[getSession] Token from localStorage:', token ? 'EXISTS' : 'NOT FOUND');
    
    if (!token) {
        console.log('[getSession] No token, returning null');
        return null;
    }
    
    // Декодируем JWT токен для получения данных пользователя
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        console.log('[getSession] Decoded payload:', payload);
        return {
            id: payload.id,
            email: payload.email,
            role: payload.role,
            name: payload.name,
            group_name: payload.group_name
        };
    } catch (e) {
        console.error('[getSession] Error decoding token:', e);
        return null;
    }
};

window.clearSession = function() {
    clearAuthToken();
};

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    console.log('KemGU API Client initialized');
});