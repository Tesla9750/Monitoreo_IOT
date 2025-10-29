document.addEventListener('DOMContentLoaded', () => {
    // IMPORTANTE: Reemplaza con la IP pública de tu instancia EC2
    const EC2_PUBLIC_IP = '44.219.48.92'; // <- Usa tu IP real
    const API_BASE_URL = `http://${EC2_PUBLIC_IP}:8000`;
    const WS_URL = `ws://${EC2_PUBLIC_IP}:8000/ws`;

    // --- Elementos del DOM ---
    const deviceSelector = document.getElementById('device-selector-map');
    const clearMapBtn = document.getElementById('clear-map-btn');
    const mapContainer = document.getElementById('map-container');
    const mapContent = document.getElementById('map-content'); // El nuevo contenedor para zoom
    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    const zoomLevelDisplay = document.getElementById('zoom-level-display');

    // --- Estado del Zoom ---
    let scale = 1.0;
    const ZOOM_INCREMENT = 0.2;
    const MAX_ZOOM = 3.0;
    const MIN_ZOOM = 0.4;

    // --- Configuración del Mapa Cartesiano ---
    const MAP_MIN_X = -50;
    const MAP_MAX_X = 50;
    const MAP_MIN_Y = -50;
    const MAP_MAX_Y = 50;

    function coordinateToPercentage(value, min, max) {
        const range = max - min;
        return ((value - min) / range) * 100;
    }

    /**
     * Aplica el nivel de zoom actual al mapa y actualiza el display.
     */
    function applyZoom() {
        mapContent.style.transform = `scale(${scale})`;
        zoomLevelDisplay.textContent = `${Math.round(scale * 100)}%`;
    }

    async function fetchAndRenderMap(deviceId) {
        mapContent.innerHTML = ''; // Limpiar marcadores del contenedor de zoom

        try {
            const response = await fetch(`${API_BASE_URL}/map/${deviceId}`);
            if (!response.ok) throw new Error('No se pudo cargar el mapa.');

            const obstacles = await response.json();

            obstacles.forEach(obstacle => {
                const marker = document.createElement('div');
                marker.className = 'obstacle-marker';
                marker.style.left = `${coordinateToPercentage(obstacle.coordenada_x, MAP_MIN_X, MAP_MAX_X)}%`;
                marker.style.top = `${100 - coordinateToPercentage(obstacle.coordenada_y, MAP_MIN_Y, MAP_MAX_Y)}%`;
                marker.title = `Visto por Robot #${obstacle.dispositivo_id || deviceId} en (X:${obstacle.coordenada_x}, Y:${obstacle.coordenada_y})`;
                
                mapContent.appendChild(marker); // Añadir marcadores al contenedor de zoom
            });

        } catch (error) {
            console.error("Error al renderizar el mapa:", error);
        }
    }
    /**
     * Limpia el mapa de obstáculos para el dispositivo seleccionado.
     */
    async function clearMap() {
        const selectedDeviceId = deviceSelector.value;
        if (selectedDeviceId === '0') {
            alert('Por favor, selecciona un dispositivo específico para limpiar su mapa.');
            return;
        }

        const confirmation = confirm(`¿Estás seguro de que quieres borrar el mapa del dispositivo #${selectedDeviceId}? Esta acción no se puede deshacer.`);
        if (!confirmation) return;

        try {
            const response = await fetch(`${API_BASE_URL}/map/${selectedDeviceId}`, {
                method: 'DELETE'
            });

            if (!response.ok) throw new Error('No se pudo limpiar el mapa.');
            fetchAndRenderMap(selectedDeviceId);

        } catch (error) {
            console.error("Error al limpiar el mapa:", error);
            alert('Ocurrió un error al intentar limpiar el mapa.');
        }
    }

    /**
     * Conecta al WebSocket para recibir actualizaciones en tiempo real.
     */
    function connectWebSocket() {
        const socket = new WebSocket(WS_URL);
        socket.onopen = () => console.log("Mapa conectado a WebSocket.");
        socket.onmessage = (event) => {
            const message = JSON.parse(event.data);

            if (message.event === 'obstacle_detected' || message.event === 'map_cleared') {
                console.log(`Evento '${message.event}' recibido. Actualizando mapa...`);
                const currentSelection = deviceSelector.value;
                fetchAndRenderMap(currentSelection);
            }
        };
        socket.onclose = () => {
            console.log("WebSocket del mapa desconectado, reconectando...");
            setTimeout(connectWebSocket, 5000);
        };
    }

  // --- Asignación de Eventos ---
    deviceSelector.addEventListener('change', () => fetchAndRenderMap(deviceSelector.value));
    clearMapBtn.addEventListener('click', clearMap);
    
    // NUEVO: Eventos para los botones de zoom
    zoomInBtn.addEventListener('click', () => {
        scale = Math.min(MAX_ZOOM, scale + ZOOM_INCREMENT);
        applyZoom();
    });

    zoomOutBtn.addEventListener('click', () => {
        scale = Math.max(MIN_ZOOM, scale - ZOOM_INCREMENT);
        applyZoom();
    });

    // --- Inicialización ---
    applyZoom(); // Aplicar zoom inicial
    fetchAndRenderMap(deviceSelector.value);
    connectWebSocket();
});