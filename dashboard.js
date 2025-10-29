document.addEventListener('DOMContentLoaded', () => {
    // IMPORTANTE: Reemplaza con la IP pública de tu instancia EC2
    const EC2_PUBLIC_IP = '44.219.48.92';
    const API_BASE_URL = `http://${EC2_PUBLIC_IP}:8000`;
    const WS_URL = `ws://${EC2_PUBLIC_IP}:8000/ws`;

    // ID del dispositivo que vamos a monitorear
    const DEVICE_ID = 1;

    // --- Elementos del DOM para la tarjeta de estado ---
    const deviceName = document.getElementById('device-name-1');
    const statusDot = document.getElementById('device-status-dot-1');
    const statusText = document.getElementById('device-status-text-1');
    const lastMove = document.getElementById('device-last-move-1');
    const lastObstacle = document.getElementById('device-last-obstacle-1');

    // --- Contextos para los gráficos ---
    const movementsCtx = document.getElementById('movementsChart').getContext('2d');
    const demosCtx = document.getElementById('demosChart').getContext('2d');
    let movementsChart, demosChart; // Variables para almacenar las instancias de los gráficos

    /**
     * Actualiza la tarjeta de estado con los datos más recientes.
     */
    async function updateStatusCard() {
        try {
            // Hacemos las llamadas en paralelo para eficiencia
            const [moveRes, obstacleRes] = await Promise.all([
                fetch(`${API_BASE_URL}/movements/${DEVICE_ID}/last`),
                fetch(`${API_BASE_URL}/obstacles/${DEVICE_ID}/last`)
            ]);

            // Actualizar el nombre y estado (asumimos online si la API responde)
            deviceName.textContent = `ESP8266-Car-${String(DEVICE_ID).padStart(2, '0')}`;
            statusDot.className = 'status-dot online';
            statusText.textContent = 'Conectado';

            // Actualizar último movimiento
            const moveData = await moveRes.json();
            if (moveData.length > 0) {
                lastMove.textContent = moveData[0].ultimo_movimiento;
                lastMove.className = 'fw-bold ' + (moveData[0].ultimo_movimiento === 'Detener' ? 'text-danger' : 'text-success');
            } else {
                lastMove.textContent = 'Sin registros';
            }

            // Actualizar último obstáculo
            const obstacleData = await obstacleRes.json();
            if (obstacleData.length > 0) {
                lastObstacle.textContent = obstacleData[0].obstaculo;
                lastObstacle.className = 'fw-bold text-warning';
            } else {
                lastObstacle.textContent = 'Ninguno reciente';
                lastObstacle.className = 'fw-bold text-secondary';
            }

        } catch (error) {
            console.error("Error actualizando la tarjeta de estado:", error);
            deviceName.textContent = `ESP8266-Car-${String(DEVICE_ID).padStart(2, '0')}`;
            statusDot.className = 'status-dot offline';
            statusText.textContent = 'Error de conexión';
        }
    }

    /**
     * Obtiene los datos de historial y renderiza el gráfico de distribución de movimientos.
     */
    async function renderMovementsChart() {
        try {
            const response = await fetch(`${API_BASE_URL}/movements/${DEVICE_ID}/history?limit=100`);
            const data = await response.json();

            const movementCounts = data.reduce((acc, item) => {
                acc[item.movimiento] = (acc[item.movimiento] || 0) + 1;
                return acc;
            }, {});

            if (movementsChart) movementsChart.destroy(); // Limpiar gráfico anterior
            movementsChart = new Chart(movementsCtx, {
                type: 'pie',
                data: {
                    labels: Object.keys(movementCounts),
                    datasets: [{
                        label: 'Movimientos',
                        data: Object.values(movementCounts),
                        backgroundColor: ['#2575fc', '#ff6b6b', '#6a11cb', '#fd7e14', '#20c997', '#6f42c1'],
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        } catch (error) {
            console.error("Error renderizando el gráfico de movimientos:", error);
        }
    }

    /**
     * Obtiene los datos de historial y renderiza el gráfico de demos ejecutadas.
     */
    async function renderDemosChart() {
        try {
            const response = await fetch(`${API_BASE_URL}/demos/executions?limit=100`);
            const data = await response.json();

            const demoCounts = data.reduce((acc, item) => {
                acc[item.nombre_demo] = (acc[item.nombre_demo] || 0) + 1;
                return acc;
            }, {});
            
            if (demosChart) demosChart.destroy(); // Limpiar gráfico anterior
            demosChart = new Chart(demosCtx, {
                type: 'bar',
                data: {
                    labels: Object.keys(demoCounts),
                    datasets: [{
                        label: 'Nº de Ejecuciones',
                        data: Object.values(demoCounts),
                        backgroundColor: '#6a11cb',
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        } catch (error) {
            console.error("Error renderizando el gráfico de demos:", error);
        }
    }

    /**
     * Conecta al WebSocket para recibir actualizaciones en tiempo real.
     */
    function connectWebSocket() {
        const socket = new WebSocket(WS_URL);
        socket.onopen = () => console.log("Dashboard conectado a WebSocket.");
        socket.onmessage = (event) => {
            const message = JSON.parse(event.data);
            console.log("Push recibido:", message);

            // Si el evento afecta al dispositivo que estamos viendo, actualizamos
            if (message.deviceId === DEVICE_ID) {
                if (message.event === 'new_movement' || message.event === 'obstacle_detected') {
                    updateStatusCard(); // Actualiza la tarjeta de estado en tiempo real
                }
                // Si se ejecuta una demo o hay un nuevo movimiento, los gráficos podrían cambiar
                if (message.event === 'demo_executed' || message.event === 'new_movement') {
                    renderMovementsChart();
                    renderDemosChart();
                }
            }
        };
        socket.onclose = () => {
            console.log("WebSocket desconectado, reconectando...");
            setTimeout(connectWebSocket, 5000);
        };
    }

    // --- Carga inicial de toda la página ---
    function initializeDashboard() {
        updateStatusCard();
        renderMovementsChart();
        renderDemosChart();
        connectWebSocket();
    }

    initializeDashboard();
});