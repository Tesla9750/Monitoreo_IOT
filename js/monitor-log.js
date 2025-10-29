document.addEventListener('DOMContentLoaded', () => {
    // IMPORTANTE: Reemplaza con la IP pública de tu instancia EC2
    const EC2_PUBLIC_IP = '44.219.48.92';
    const API_BASE_URL = `http://${EC2_PUBLIC_IP}:8000`;
    const WS_URL = `ws://${EC2_PUBLIC_IP}:8000/ws`; // <-- URL para la conexión en tiempo real

    // Elementos del DOM
    const deviceSelector = document.getElementById('device-selector');
    const movementsTableBody = document.getElementById('movements-log-table');
    const obstaclesTableBody = document.getElementById('obstacles-log-table');
    const demosTableBody = document.getElementById('demos-log-table');

    // --- Funciones para poblar las tablas (esto es PULL, se usa para la carga inicial) ---
    function populateMovementsTable(data) {
        if (!data || data.length === 0) {
            movementsTableBody.innerHTML = '<tr><td colspan="3" class="text-center">No hay registros de movimientos.</td></tr>';
            return;
        }
        movementsTableBody.innerHTML = data.map(log => `
            <tr>
                <td>${new Date(log.fecha_hora_evento).toLocaleString('es-MX')}</td>
                <td>${log.movimiento}</td>
                <td>${log.obstaculo ? `<span class="badge bg-event-obstacle">${log.obstaculo}</span>` : 'No'}</td>
            </tr>
        `).join('');
    }

    function populateObstaclesTable(data) {
        if (!data || data.length === 0) {
            obstaclesTableBody.innerHTML = '<tr><td colspan="3" class="text-center">No hay registros de obstáculos.</td></tr>';
            return;
        }
        obstaclesTableBody.innerHTML = data.map(log => `
            <tr>
                <td>${new Date(log.fecha_hora_evento).toLocaleString('es-MX')}</td>
                <td>${log.obstaculo}</td>
                <td>${log.reaccion}</td>
            </tr>
        `).join('');
    }

    function populateDemosTable(data) {
        if (!data || data.length === 0) {
            demosTableBody.innerHTML = '<tr><td colspan="3" class="text-center">No hay registros de demos.</td></tr>';
            return;
        }
        demosTableBody.innerHTML = data.map(log => `
            <tr>
                <td>${new Date(log.fecha_ejecucion).toLocaleString('es-MX')}</td>
                <td>${log.nombre_demo}</td>
                <td>${log.nombre_dispositivo}</td>
            </tr>
        `).join('');
    }
    
    // --- Función principal para cargar todos los logs (PULL) ---
    async function fetchAllLogs(deviceId) {
        const loadingHTML = '<tr><td colspan="3" class="text-center">Cargando...</td></tr>';
        movementsTableBody.innerHTML = loadingHTML;
        obstaclesTableBody.innerHTML = loadingHTML;
        demosTableBody.innerHTML = loadingHTML;

        try {
            const [movementsRes, obstaclesRes, demosRes] = await Promise.all([
                fetch(`${API_BASE_URL}/movements/${deviceId}/history?limit=20`),
                fetch(`${API_BASE_URL}/obstacles/${deviceId}/history?limit=20`),
                fetch(`${API_BASE_URL}/demos/executions?limit=20`)
            ]);

            const movements = await movementsRes.json();
            populateMovementsTable(movements);

            const obstacles = await obstaclesRes.json();
            populateObstaclesTable(obstacles);

            const demos = await demosRes.json();
            populateDemosTable(demos);
        } catch (error) {
            console.error("Error al cargar los logs:", error);
            const errorHTML = '<tr><td colspan="3" class="text-center text-danger">Error al cargar datos.</td></tr>';
            movementsTableBody.innerHTML = errorHTML;
            obstaclesTableBody.innerHTML = errorHTML;
            demosTableBody.innerHTML = errorHTML;
        }
    }

 // --- Lógica de WebSocket para actualizaciones en tiempo real (PUSH) ---
    function connectWebSocket() {
        // Aquí es donde se establece la conexión
        const socket = new WebSocket(WS_URL);

        socket.onopen = () => console.log("Bitácora conectada al WebSocket para recibir actualizaciones PUSH.");

        // Cuando el servidor envía un mensaje (push), esta función se activa
        socket.onmessage = (event) => {
            const message = JSON.parse(event.data);
            console.log("¡PUSH Recibido del servidor!", message);
            
            // Si el evento es relevante, se recargan las tablas
            if (message.event === "new_movement" || message.event === "obstacle_detected" || message.event === "demo_executed") {
                console.log("Actualizando tablas por notificación PUSH...");
                const selectedDeviceId = deviceSelector.value;
                fetchAllLogs(selectedDeviceId);
            }
        };

        socket.onclose = () => {
            console.log("WebSocket desconectado. Intentando reconectar en 5 segundos...");
            setTimeout(connectWebSocket, 5000);
        };
        
        // Si ves un error aquí en la consola, el problema es de conexión
        socket.onerror = (error) => {
             console.error("Error de WebSocket:", error);
        }
    }

    // --- Event Listeners e inicialización ---
    deviceSelector.addEventListener('change', () => {
        const selectedDeviceId = deviceSelector.value;
        fetchAllLogs(selectedDeviceId);
    });

    fetchAllLogs(deviceSelector.value); 
    connectWebSocket(); // Inicia la escucha de eventos PUSH
});