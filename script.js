// ========== CONFIGURACIÓN ==========
const API_URL = 'https://koswwxcrcolddejbmoeu.supabase.co';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtvc3d3eGNyY29sZGRlamJtb2V1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4ODc0MjUsImV4cCI6MjA4MzQ2MzQyNX0.1qCyy6_Ead2ohpBqCpgas1ZRSckVbxPnCmGLTU2XIEQ';

const CAPAS = [
    { nombre: 'copia113', tipo: 'POINT', color: '#FF0000', icono: '🌴' },
    { nombre: 'copia49', tipo: 'POINT', color: '#0000FF', icono: '🌴' },
    { nombre: 'nueva181', tipo: 'POINT', color: '#00FF00', icono: '🌴' },
    { nombre: 'incidencias', tipo: 'POINT', color: '#FF6B6B', icono: '⚠️' }
];

// ========== VARIABLES GLOBALES ==========
let map;
let layerGroups = {};
let ubicacionActual = null;
let modoClickMapa = false;

// ========== INICIALIZACIÓN ==========
window.onload = function() {
    inicializarMapa();
    inicializarEventos();
    cargarTodasLasCapas();
    
    // Establecer fecha de hoy por defecto
    document.getElementById('fecha-deteccion').valueAsDate = new Date();
};

function inicializarMapa() {
    map = L.map('map', {
        maxZoom: 22,
        minZoom: 2
    }).setView([38.2699, -0.6983], 13);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19
    }).addTo(map);
    
    // Event listener para click en el mapa
    map.on('click', function(e) {
        if (!modoClickMapa) return;
        
        ubicacionActual = {
            lat: e.latlng.lat,
            lon: e.latlng.lng
        };
        
        mostrarUbicacionMarcada();
        crearMarcadorTemporal(ubicacionActual.lat, ubicacionActual.lon);
        
        modoClickMapa = false;
        document.getElementById('map').style.cursor = '';
    });
}

function inicializarEventos() {
    // Toggle sidebar en móvil
    document.getElementById('menu-toggle').addEventListener('click', function() {
        document.getElementById('sidebar').classList.toggle('hidden');
    });
}

// ========== GESTIÓN DE CAPAS ==========
async function cargarTodasLasCapas() {
    crearPanelCapas();
    
    for (const capa of CAPAS) {
        await cargarCapa(capa.nombre, capa.tipo, capa.color);
    }
}

function crearPanelCapas() {
    let html = '';
    
    CAPAS.forEach(capa => {
        html += `
            <div class="capa-item">
                <label>
                    <input type="checkbox" checked onchange="toggleCapa('${capa.nombre}')">
                    <span>${capa.icono}</span>
                    <span style="color:${capa.color}">●</span>
                    <strong>${capa.nombre}</strong>
                </label>
            </div>
        `;
    });
    
    document.getElementById('capas-lista').innerHTML = html;
}

async function cargarCapa(nombreCapa, tipoCapa, color) {
    try {
        const response = await fetch(`${API_URL}/rest/v1/${nombreCapa}?select=*`, {
            method: 'GET',
            headers: {
                'apikey': API_KEY,
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            console.error(`Error cargando ${nombreCapa}`);
            return;
        }

        const data = await response.json();
        const layerGroup = L.layerGroup();
        
        data.forEach(feature => {
            const geom = parseGeometry(feature.geom);
            if (!geom) return;
            
            if (geom.type === 'Point') {
                crearMarcadorPunto(geom, feature, nombreCapa, color, layerGroup);
            } else if (geom.type === 'LineString') {
                crearLinea(geom, feature, nombreCapa, color, layerGroup);
            } else if (geom.type === 'Polygon') {
                crearPoligono(geom, feature, nombreCapa, color, layerGroup);
            }
        });

        layerGroups[nombreCapa] = layerGroup;
        layerGroup.addTo(map);
        
        if (Object.keys(layerGroups).length === 1) {
            const bounds = layerGroup.getBounds();
            if (bounds.isValid()) {
                map.fitBounds(bounds);
            }
        }
        
        console.log(`Capa ${nombreCapa} cargada: ${data.length} elementos`);
        
    } catch (error) {
        console.error('Error:', error);
    }
}

function crearMarcadorPunto(geom, feature, nombreCapa, color, layerGroup) {
    const marker = L.circleMarker([geom.coordinates[1], geom.coordinates[0]], {
        radius: 8,
        fillColor: color,
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8
    });
    
    marker.bindPopup(crearPopupHTML(feature, nombreCapa));
    marker.addTo(layerGroup);
}

function crearLinea(geom, feature, nombreCapa, color, layerGroup) {
    const coords = geom.coordinates.map(c => [c[1], c[0]]);
    const line = L.polyline(coords, {
        color: color,
        weight: 3
    });
    
    line.bindPopup(crearPopupHTML(feature, nombreCapa));
    line.addTo(layerGroup);
}

function crearPoligono(geom, feature, nombreCapa, color, layerGroup) {
    const coords = geom.coordinates[0].map(c => [c[1], c[0]]);
    const polygon = L.polygon(coords, {
        color: color,
        fillColor: color,
        fillOpacity: 0.3
    });
    
    polygon.bindPopup(crearPopupHTML(feature, nombreCapa));
    polygon.addTo(layerGroup);
}

function crearPopupHTML(feature, nombreCapa) {
    let html = `<div style="min-width:200px;">`;
    html += `<h3 style="margin:0 0 10px 0; color: var(--primary-blue);">${nombreCapa}</h3>`;
    html += `<table style="font-size:12px;">`;
    
    Object.keys(feature).forEach(key => {
        if (key !== 'geom') {
            const valor = feature[key] === null ? '<em>Sin dato</em>' : feature[key];
            html += `<tr><td style="padding:2px 5px; font-weight:bold;">${key}:</td><td style="padding:2px 5px;">${valor}</td></tr>`;
        }
    });
    
    html += `</table></div>`;
    return html;
}

function toggleCapa(nombreCapa) {
    const layer = layerGroups[nombreCapa];
    if (layer) {
        if (map.hasLayer(layer)) {
            map.removeLayer(layer);
        } else {
            map.addLayer(layer);
        }
    }
}

// ========== CONVERSIÓN DE GEOMETRÍAS ==========
function parseGeometry(geomData) {
    if (!geomData) return null;
    
    if (geomData.coordinates) {
        return geomData;
    }
    
    if (typeof geomData === 'string') {
        const pointMatch = geomData.match(/POINT\s*\(([^)]+)\)/i);
        if (pointMatch) {
            const coords = pointMatch[1].trim().split(/\s+/);
            return {
                type: 'Point',
                coordinates: [parseFloat(coords[0]), parseFloat(coords[1])]
            };
        }
        
        const linestringMatch = geomData.match(/LINESTRING\s*\(([^)]+)\)/i);
        if (linestringMatch) {
            const coords = linestringMatch[1].split(',').map(pair => {
                const [x, y] = pair.trim().split(/\s+/);
                return [parseFloat(x), parseFloat(y)];
            });
            return { type: 'LineString', coordinates: coords };
        }
        
        const polygonMatch = geomData.match(/POLYGON\s*\(\(([^)]+)\)\)/i);
        if (polygonMatch) {
            const coords = polygonMatch[1].split(',').map(pair => {
                const [x, y] = pair.trim().split(/\s+/);
                return [parseFloat(x), parseFloat(y)];
            });
            return { type: 'Polygon', coordinates: [coords] };
        }
    }
    
    return null;
}

// ========== UBICACIÓN ==========
window.activarClickMapa = function() {
    modoClickMapa = true;
    document.getElementById('coordenadas-info').innerHTML = 
        '<span class="text-warning">🗺️ Haz clic en el mapa para marcar la ubicación</span>';
    document.getElementById('map').style.cursor = 'crosshair';
};

window.obtenerUbicacion = function() {
    document.getElementById('coordenadas-info').innerHTML = 
        '<span class="text-warning">📡 Obteniendo ubicación...</span>';
    
    if (!navigator.geolocation) {
        alert('Tu navegador no soporta geolocalización');
        return;
    }
    
    navigator.geolocation.getCurrentPosition(
        function(position) {
            ubicacionActual = {
                lat: position.coords.latitude,
                lon: position.coords.longitude
            };
            
            mostrarUbicacionObtenida();
            crearMarcadorTemporal(ubicacionActual.lat, ubicacionActual.lon);
            map.setView([ubicacionActual.lat, ubicacionActual.lon], 16);
        },
        function(error) {
            document.getElementById('coordenadas-info').innerHTML = 
                `<span class="text-danger">❌ Error: ${error.message}</span>`;
        }
    );
};

function mostrarUbicacionMarcada() {
    document.getElementById('coordenadas-info').innerHTML = 
        `<span class="text-success">✓ Ubicación marcada<br>
        Lat: ${ubicacionActual.lat.toFixed(6)}<br>
        Lon: ${ubicacionActual.lon.toFixed(6)}</span>`;
}

function mostrarUbicacionObtenida() {
    document.getElementById('coordenadas-info').innerHTML = 
        `<span class="text-success">✓ Ubicación obtenida<br>
        Lat: ${ubicacionActual.lat.toFixed(6)}<br>
        Lon: ${ubicacionActual.lon.toFixed(6)}</span>`;
}

function crearMarcadorTemporal(lat, lon) {
    if (window.marcadorTemporal) {
        map.removeLayer(window.marcadorTemporal);
    }
    
    window.marcadorTemporal = L.marker([lat, lon], {
        icon: L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        })
    }).addTo(map);
}

// ========== REPORTAR INCIDENCIA ==========
window.reportarIncidencia = async function() {
    const nombre = document.getElementById('nombre-usuario').value.trim();
    const tipo = document.getElementById('tipo-incidencia').value;
    const fechaDeteccion = document.getElementById('fecha-deteccion').value;
    const comentarios = document.getElementById('comentarios').value.trim();
    
    if (!nombre || !tipo) {
        alert('Por favor, completa nombre y tipo de incidencia');
        return;
    }
    
    if (!fechaDeteccion) {
        alert('Por favor, indica cuándo detectaste la incidencia');
        return;
    }
    
    if (!ubicacionActual) {
        alert('Primero obtén tu ubicación:\n- Usando GPS o\n- Marcando en el mapa');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/rest/v1/incidencias`, {
            method: 'POST',
            headers: {
                'apikey': API_KEY,
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({
                nombre: nombre,
                tipo_requerimiento: tipo,
                fecha_deteccion: fechaDeteccion,
                comentarios: comentarios || null,
                lat: ubicacionActual.lat,
                lon: ubicacionActual.lon
            })
        });
        
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Error al reportar: ${error}`);
        }
        
        alert('✓ Incidencia reportada exitosamente');
        
        limpiarFormularioIncidencia();
        
        if (window.marcadorTemporal) {
            map.removeLayer(window.marcadorTemporal);
        }
        
        await cargarCapa('incidencias', 'POINT', '#FF6B6B');
        
    } catch (error) {
        alert(`Error: ${error.message}`);
        console.error(error);
    }
};

function limpiarFormularioIncidencia() {
    document.getElementById('nombre-usuario').value = '';
    document.getElementById('tipo-incidencia').value = '';
    document.getElementById('fecha-deteccion').valueAsDate = new Date();
    document.getElementById('comentarios').value = '';
    document.getElementById('coordenadas-info').innerHTML = '';
    ubicacionActual = null;
}

// ========== BUSCAR POR SEXO ==========
window.buscarPorSexo = async function() {
    const sexoBuscado = document.getElementById('sexo-select').value;
    
    if (!sexoBuscado) {
        alert('Selecciona un sexo primero');
        return;
    }
    
    document.getElementById('resultado-busqueda').innerHTML = '<p class="loading">Buscando...</p>';
    
    try {
        const response = await fetch(`${API_URL}/rest/v1/rpc/buscar_por_sexo`, {
            method: 'POST',
            headers: {
                'apikey': API_KEY,
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ sexo_buscado: sexoBuscado })
        });
        
        if (!response.ok) throw new Error('Error al buscar');
        
        const data = await response.json();
        
        if (data.length === 0) {
            document.getElementById('resultado-busqueda').innerHTML = 
                `<p>No se encontraron palmeras de tipo <strong>${sexoBuscado}</strong></p>`;
            return;
        }
        
        let html = `<h4 style="margin-top:0;">Palmeras ${sexoBuscado}:</h4>`;
        html += '<table><tr><th>Capa</th><th>Cantidad</th></tr>';
        
        let total = 0;
        data.forEach(row => {
            html += `<tr><td><strong>${row.capa}</strong></td><td>${row.cantidad}</td></tr>`;
            total += parseInt(row.cantidad);
        });
        
        html += `<tr style="font-weight:bold; background:var(--bg-light);"><td>TOTAL</td><td>${total}</td></tr>`;
        html += '</table>';
        
        document.getElementById('resultado-busqueda').innerHTML = html;
        
    } catch (error) {
        document.getElementById('resultado-busqueda').innerHTML = 
            `<p class="text-danger">Error: ${error.message}</p>`;
        console.error(error);
    }
};

// ========== ANALIZAR POR SEXO ==========
window.analizarSexo = async function() {
    const capaSeleccionada = document.getElementById('capa-select').value;
    
    if (!capaSeleccionada) {
        alert('Selecciona una capa primero');
        return;
    }
    
    document.getElementById('resultado-sexo').innerHTML = '<p class="loading">Analizando...</p>';
    
    try {
        const response = await fetch(`${API_URL}/rest/v1/rpc/contar_por_sexo`, {
            method: 'POST',
            headers: {
                'apikey': API_KEY,
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ nombre_tabla: capaSeleccionada })
        });
        
        if (!response.ok) throw new Error('Error al analizar');
        
        const data = await response.json();
        
        let html = '<h4 style="margin-top:0;">Resultados:</h4>';
        html += '<table><tr><th>Sexo</th><th>Cantidad</th></tr>';
        
        let total = 0;
        data.forEach(row => {
            html += `<tr><td>${row.sexo}</td><td>${row.cantidad}</td></tr>`;
            total += parseInt(row.cantidad);
        });
        
        html += `<tr style="font-weight:bold; background:var(--bg-light);"><td>TOTAL</td><td>${total}</td></tr>`;
        html += '</table>';
        
        document.getElementById('resultado-sexo').innerHTML = html;
        
    } catch (error) {
        document.getElementById('resultado-sexo').innerHTML = 
            `<p class="text-danger">Error: ${error.message}</p>`;
        console.error(error);
    }
};
