/**
 * API Service - Maneja las comunicaciones con el backend y Oracle
 */
const API = {
    baseUrl: 'http://localhost:3000/api',

    async get(endpoint) {
        const response = await fetch(`${this.baseUrl}${endpoint}`);
        if (!response.ok) throw await response.json();
        return await response.json();
    },

    async post(endpoint, data) {
        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (!response.ok) {
                // Requerimiento: Si el error contiene el código de Oracle -20502 o -20501
                const msg = result.message || JSON.stringify(result);
                if (msg.includes('-20502') || msg.includes('-20501')) {
                    ui.showSecurityAlert();
                }
                throw result;
            }

            return result;
        } catch (error) {
            throw error;
        }
    },

    async put(endpoint, data) {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await response.json();
        if (!response.ok) throw result;
        return result;
    },

    async delete(endpoint) {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            method: 'DELETE'
        });
        const result = await response.json();
        if (!response.ok) throw result;
        return result;
    }
};