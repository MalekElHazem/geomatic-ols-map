let viewer;
let olsDataSources = new Map();
let surfaceVisibility = new Map();
let currentOpacity = 0.7;

// OLS surface configurations with new color scheme
const olsConfig = {
    takeoff: { 
        color: Cesium.Color.fromCssColorString('#ef4444'), // Modern red
        name: 'Take-off Surface',
        files: ['takeoff', 'take_off', 'ols_takeoff']
    },
    approach: { 
        color: Cesium.Color.fromCssColorString('#f59e0b'), // Amber/orange
        name: 'Approach Surface',
        files: ['approach', 'ols_approach', 'surfaceapproche']
    },
    transitional: { 
        color: Cesium.Color.fromCssColorString('#eab308'), // Yellow
        name: 'Transitional Surface',
        files: ['transitional', 'ols_transitional']
    },
    horizontal: { 
        color: Cesium.Color.fromCssColorString('#3b82f6'), // Blue
        name: 'Horizontal Surface',
        files: ['horizontal', 'ols_horizontal']
    },
    conical: { 
        color: Cesium.Color.fromCssColorString('#06b6d4'), // Cyan
        name: 'Conical Surface',
        files: ['conical', 'ols_conical']
    },
    inner: { 
        color: Cesium.Color.fromCssColorString('#8b5cf6'), // Purple
        name: 'Inner Horizontal Surface',
        files: ['inner', 'inner_horizontal', 'ols_inner']
    },
    obstacles: { 
        color: Cesium.Color.fromCssColorString('#ef4444'), // Red for obstacles
        name: 'Airport Obstacles',
        files: ['obstacles']
    }
};

// Initialize all surface types as visible
Object.keys(olsConfig).forEach(type => {
    surfaceVisibility.set(type, true);
});

// Initialize Cesium viewer
function initializeViewer() {
    updateStatus("🌍 Initializing 3D viewer with real terrain...");
    
    viewer = new Cesium.Viewer("cesiumContainer", {
        terrainProvider: new Cesium.CesiumTerrainProvider({
            url: Cesium.IonResource.fromAssetId(1),
            requestWaterMask: true,
            requestVertexNormals: true
        }),
        baseLayerPicker: false,
        timeline: false,
        animation: false,
        geocoder: false,
        homeButton: false,
        sceneModePicker: false,
        navigationHelpButton: false,
        infoBox: true,
        resolutionScale: 1.0
    });
    
    // Enable lighting for better 3D visualization
    viewer.scene.globe.enableLighting = true;
    
    // Set time to midday for optimal lighting
    const midday = new Date();
    midday.setHours(12, 0, 0, 0); // Set to 12:00 PM
    viewer.clock.currentTime = Cesium.JulianDate.fromDate(midday);
    viewer.clock.shouldAnimate = false; // Stop time animation
    
    // Add high-resolution satellite imagery
    const esriProvider = new Cesium.UrlTemplateImageryProvider({
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        maximumLevel: 20,
        credit: 'Tiles © Esri'
    });
    viewer.imageryLayers.addImageryProvider(esriProvider);
    
    // Set initial camera position over Tunis-Carthage Airport
    resetToAirport();
    
    // Automatically toggle terrain on startup
    setTimeout(() => {
        toggleTerrain();
    }, 500);
    
    updateStatus("✅ 3D viewer ready with real terrain!");
    
    // Auto-load OLS data immediately
    setTimeout(() => {
        loadAllOLSSurfaces();
    }, 1000);
}

// Load all OLS surfaces with corrected paths for GitHub Pages
function loadAllOLSSurfaces() {
    updateStatus("🔄 Loading OLS surfaces...");
    let loadCount = 0;
    let totalAttempts = 0;
    let completedAttempts = 0;
    
    // Simplified paths for GitHub Pages hosting
    const basePaths = [
        './data/',
        './'
    ];
    
    Object.entries(olsConfig).forEach(([surfaceType, config]) => {
        config.files.forEach(fileName => {
            basePaths.forEach(basePath => {
                const filePath = `${basePath}${fileName}.geojson`;
                totalAttempts++;
                
                Cesium.GeoJsonDataSource.load(filePath)
                    .then(function(dataSource) {
                        loadOLSSurface(dataSource, surfaceType, config);
                        loadCount++;
                        updateStatus(`📂 Loaded ${loadCount} OLS surface(s) - ${config.name}`);
                        
                        // Auto-focus on first loaded surface
                        if (loadCount === 1) {
                            viewer.flyTo(dataSource);
                        }
                    })
                    .catch(function(error) {
                        // Silently fail for non-existent files
                        console.log(`File not found: ${filePath}`);
                    })
                    .finally(() => {
                        completedAttempts++;
                        
                        // Check if all attempts are complete
                        if (completedAttempts === totalAttempts) {
                            if (loadCount === 0) {
                                updateStatus("⚠️ No OLS files found. Place .geojson files in the data/ folder.");
                            } else {
                                updateStatus(`✅ Successfully loaded ${loadCount} OLS surface(s)`);
                            }
                        }
                    });
            });
        });
    });
}

// Enhanced obstacle management
let obstacleData = [];
let filteredObstacles = [];
let obstacleTypes = new Set();

// Load obstacles from JSON file with corrected paths
function loadObstacles() {
    updateStatus("🏗️ Loading airport obstacles...");
    
    const obstaclePaths = [
        './data/obstacles.json',
        './obstacles.json'
    ];
    
    let loadSuccess = false;
    
    // Try each path
    obstaclePaths.forEach(filePath => {
        if (!loadSuccess) {
            fetch(filePath)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    loadSuccess = true;
                    obstacleData = data.features || [];
                    processObstacles();
                    populateObstaclePanel();
                    updateStatus(`✅ Loaded ${obstacleData.length} obstacles successfully!`);
                })
                .catch(error => {
                    console.warn(`Failed to load from ${filePath}:`, error);
                });
        }
    });
    
    setTimeout(() => {
        if (!loadSuccess) {
            updateStatus("❌ Failed to load obstacles from all paths");
        }
    }, 3000);
}

function processObstacles() {
    if (!obstacleData.length) return;
    
    // Create a data source for obstacles
    const obstacleDataSource = new Cesium.GeoJsonDataSource();
    viewer.dataSources.add(obstacleDataSource);
    olsDataSources.set('obstacles', obstacleDataSource);
    
    obstacleTypes.clear();
    
    obstacleData.forEach((feature, index) => {
        if (!feature.geometry || !feature.geometry.coordinates) return;
        
        const coords = feature.geometry.coordinates;
        const props = feature.properties;
        
        // Parse altitude
        let heightValue = 50;
        if (props.altitude_m) {
            const altMatch = props.altitude_m.match(/(\d+\.?\d*)/);
            if (altMatch) {
                heightValue = parseFloat(altMatch[1]) + 10;
            }
        }
        
        const obstacleType = props.obstacles || 'Unknown';
        obstacleTypes.add(obstacleType);
        
        // Enhanced color coding
        let color = getObstacleColor(obstacleType, heightValue);
        let cylinderHeight = Math.max(heightValue, 10);
        let radius = getObstacleRadius(obstacleType, heightValue);
        
        // Create enhanced 3D obstacle
        const entity = obstacleDataSource.entities.add({
            id: `obstacle_${index}`,
            position: Cesium.Cartesian3.fromDegrees(coords[0], coords[1], cylinderHeight / 2),
            cylinder: {
                length: cylinderHeight,
                topRadius: radius,
                bottomRadius: radius,
                material: color.withAlpha(0.8),
                outline: true,
                outlineColor: color.brighten(0.3, new Cesium.Color()),
                outlineWidth: 2,
                shadows: Cesium.ShadowMode.ENABLED
            },
            label: {
                text: `${obstacleType}\n${heightValue.toFixed(0)}m`,
                font: '12pt Calibri',
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                outlineWidth: 2,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -cylinderHeight - 20),
                fillColor: Cesium.Color.WHITE,
                outlineColor: Cesium.Color.BLACK,
                show: false // Hidden by default, show on hover
            }
        });
        
        // Enhanced click handler
        entity.obstacle = feature;
    });
    
    filteredObstacles = [...obstacleData];
    setupObstacleInteractions();
}

function getObstacleColor(type, height) {
    const typeLower = type.toLowerCase();
    
    if (typeLower.includes('pylône') || typeLower.includes('tower') || typeLower.includes('antenna')) {
        return height > 100 ? Cesium.Color.fromCssColorString('#e91e63') : Cesium.Color.fromCssColorString('#f06292');
    } else if (typeLower.includes('bâtiment') || typeLower.includes('building')) {
        return height > 50 ? Cesium.Color.fromCssColorString('#5e35b1') : Cesium.Color.fromCssColorString('#7e57c2');
    } else if (typeLower.includes('aérogare') || typeLower.includes('terminal')) {
        return Cesium.Color.fromCssColorString('#00bcd4');
    } else if (typeLower.includes('hangar')) {
        return Cesium.Color.fromCssColorString('#4caf50');
    } else if (typeLower.includes('mât') || typeLower.includes('mast')) {
        return Cesium.Color.fromCssColorString('#ff9800');
    } else if (typeLower.includes('colline') || typeLower.includes('hill')) {
        return Cesium.Color.fromCssColorString('#795548');
    }
    
    // Modern height-based coloring for unknown types
    if (height > 150) return Cesium.Color.fromCssColorString('#d32f2f'); // Material Red
    if (height > 100) return Cesium.Color.fromCssColorString('#f57c00'); // Material Orange
    if (height > 50) return Cesium.Color.fromCssColorString('#fbc02d'); // Material Yellow
    if (height > 25) return Cesium.Color.fromCssColorString('#689f38'); // Material Light Green
    return Cesium.Color.fromCssColorString('#388e3c'); // Material Green
}

function getObstacleRadius(type, height) {
    const typeLower = type.toLowerCase();
    
    if (typeLower.includes('bâtiment') || typeLower.includes('building') || typeLower.includes('hangar')) {
        return Math.max(8, height * 0.3);
    } else if (typeLower.includes('aérogare') || typeLower.includes('terminal')) {
        return Math.max(12, height * 0.4);
    } else if (typeLower.includes('pylône') || typeLower.includes('tower')) {
        return Math.max(2, height * 0.1);
    }
    
    return Math.max(4, height * 0.2);
}

function setupObstacleInteractions() {
    // Hover effect - show simple info on hover
    viewer.cesiumWidget.screenSpaceEventHandler.setInputAction(function(event) {
        const pickedObject = viewer.scene.pick(event.endPosition);
        if (pickedObject && pickedObject.id && pickedObject.id.obstacle) {
            viewer.canvas.style.cursor = 'pointer';
            
            if (!pickedObject.id.label.show) {
                pickedObject.id.label.show = true;
            }
        } else {
            viewer.canvas.style.cursor = 'default';
            // Hide hover labels
            const obstacles = olsDataSources.get('obstacles');
            if (obstacles) {
                obstacles.entities.values.forEach(entity => {
                    if (entity.label && entity.label.show) {
                        entity.label.show = false;
                    }
                });
            }
        }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
    
    // Click handler to show info card
    viewer.cesiumWidget.screenSpaceEventHandler.setInputAction(function(event) {
        const pickedObject = viewer.scene.pick(event.position);
        if (pickedObject && pickedObject.id && pickedObject.id.obstacle) {
            const obstacle = pickedObject.id.obstacle;
            const props = obstacle.properties;
            
            // Parse height
            let height = 50;
            if (props.altitude_m) {
                const altMatch = props.altitude_m.match(/(\d+\.?\d*)/);
                if (altMatch) {
                    height = parseFloat(altMatch[1]);
                }
            }
            
            showObstacleInfoCard(obstacle, height);
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
}

// Obstacle panel management functions
function toggleObstaclePanel() {
    const panel = document.getElementById('obstacle-panel');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

function populateObstaclePanel() {
    updateObstacleStats();
    populateTypeFilters();
    setupPanelEventListeners();
    populateObstacleList();
}

function updateObstacleStats() {
    document.getElementById('total-obstacles').textContent = obstacleData.length;
    document.getElementById('visible-obstacles').textContent = filteredObstacles.length;
}

function populateTypeFilters() {
    const container = document.getElementById('type-filters');
    const allBtn = container.querySelector('[data-filter="all"]');
    
    // Clear existing buttons except "All"
    Array.from(container.children).forEach(btn => {
        if (btn.dataset.filter !== 'all') {
            btn.remove();
        }
    });
    
    // Add type-specific buttons
    obstacleTypes.forEach(type => {
        const btn = document.createElement('button');
        btn.className = 'filter-btn';
        btn.dataset.filter = type;
        btn.textContent = type.substring(0, 8) + (type.length > 8 ? '...' : '');
        btn.title = type;
        container.appendChild(btn);
    });
}

function setupPanelEventListeners() {
    // Type filter buttons
    document.getElementById('type-filters').addEventListener('click', (e) => {
        if (e.target.classList.contains('filter-btn')) {
            // Update active state
            document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            
            // Apply filter
            filterObstacles();
        }
    });
    
    // Height range sliders
    const minSlider = document.getElementById('height-min');
    const maxSlider = document.getElementById('height-max');
    const minValue = document.getElementById('height-min-value');
    const maxValue = document.getElementById('height-max-value');
    
    minSlider.addEventListener('input', (e) => {
        minValue.textContent = e.target.value + 'm';
        if (parseInt(e.target.value) > parseInt(maxSlider.value)) {
            maxSlider.value = e.target.value;
            maxValue.textContent = e.target.value + 'm';
        }
        filterObstacles();
    });
    
    maxSlider.addEventListener('input', (e) => {
        maxValue.textContent = e.target.value + 'm';
        if (parseInt(e.target.value) < parseInt(minSlider.value)) {
            minSlider.value = e.target.value;
            minValue.textContent = e.target.value + 'm';
        }
        filterObstacles();
    });
}

function filterObstacles() {
    const activeFilter = document.querySelector('.filter-btn.active')?.dataset.filter || 'all';
    const minHeight = parseInt(document.getElementById('height-min').value);
    const maxHeight = parseInt(document.getElementById('height-max').value);
    
    filteredObstacles = obstacleData.filter(obstacle => {
        const props = obstacle.properties;
        const type = props.obstacles || 'Unknown';
        
        // Parse height
        let height = 50;
        if (props.altitude_m) {
            const altMatch = props.altitude_m.match(/(\d+\.?\d*)/);
            if (altMatch) {
                height = parseFloat(altMatch[1]);
            }
        }
        
        // Apply filters
        const typeMatch = activeFilter === 'all' || type === activeFilter;
        const heightMatch = height >= minHeight && height <= maxHeight;
        
        return typeMatch && heightMatch;
    });
    
    updateObstacleVisibility();
    updateObstacleStats();
    populateObstacleList();
}

function updateObstacleVisibility() {
    const obstacleDataSource = olsDataSources.get('obstacles');
    if (!obstacleDataSource) return;
    
    const entities = obstacleDataSource.entities.values;
    const filteredIds = new Set(filteredObstacles.map((_, index) => `obstacle_${index}`));
    
    entities.forEach(entity => {
        entity.show = filteredIds.has(entity.id);
    });
}

function populateObstacleList() {
    const container = document.getElementById('obstacle-list');
    container.innerHTML = '';
    
    filteredObstacles.slice(0, 50).forEach((obstacle, index) => {
        const props = obstacle.properties;
        const coords = obstacle.geometry.coordinates;
        const type = props.obstacles || 'Unknown';
        
        let height = 50;
        if (props.altitude_m) {
            const altMatch = props.altitude_m.match(/(\d+\.?\d*)/);
            if (altMatch) {
                height = parseFloat(altMatch[1]);
            }
        }
        
        const item = document.createElement('div');
        item.className = 'obstacle-item';
        item.innerHTML = `
            <div class="obstacle-item-header">
                <div class="obstacle-type">${getObstacleTypeIcon(type)} ${type}</div>
                <div class="obstacle-height">${height.toFixed(0)}m</div>
            </div>
            <div class="obstacle-coords">${coords[1].toFixed(6)}°, ${coords[0].toFixed(6)}°</div>
        `;
        
        // Add click handler to show info card and highlight
        item.addEventListener('click', () => {
            // Show info card
            const obstacleData = filteredObstacles.find(obs => 
                Math.abs(obs.geometry.coordinates[0] - coords[0]) < 0.0001 &&
                Math.abs(obs.geometry.coordinates[1] - coords[1]) < 0.0001
            );
            if (obstacleData) {
                showObstacleInfoCard(obstacleData, height);
            }
            
            // Also highlight in viewer
            highlightObstacleInViewer(coords, height);
        });
        
        container.appendChild(item);
    });
    
    if (filteredObstacles.length > 50) {
        const moreItem = document.createElement('div');
        moreItem.style.textAlign = 'center';
        moreItem.style.padding = '10px';
        moreItem.style.color = '#888';
        moreItem.style.fontSize = '11px';
        moreItem.textContent = `... and ${filteredObstacles.length - 50} more obstacles`;
        container.appendChild(moreItem);
    }
}

// Clear all surfaces
function clearAllSurfaces() {
    olsDataSources.forEach((dataSource) => {
        viewer.dataSources.remove(dataSource);
    });
    olsDataSources.clear();
    updateStatus("All OLS surfaces and obstacles cleared");
}

// Load specific horizontal and conical surfaces
function loadSpecificSurfaces() {
    updateStatus("🎯 Loading horizontal, conical, and takeoff surfaces...");
    let loadCount = 0;
    
    // Define specific paths for known surfaces
    const specificPaths = [
        './data/horizontal.geojson',
        './data/conical.geojson',
        './data/takeoff.geojson',
        './horizontal.geojson',
        './conical.geojson',
        './takeoff.geojson'
    ];
    
    const surfaceTypes = {
        'horizontal': olsConfig.horizontal,
        'conical': olsConfig.conical,
        'takeoff': olsConfig.takeoff
    };
    
    specificPaths.forEach(filePath => {
        const fileName = filePath.split('/').pop().replace('.geojson', '');
        const config = surfaceTypes[fileName];
        
        if (config) {
            Cesium.GeoJsonDataSource.load(filePath)
                .then(function(dataSource) {
                    loadOLSSurface(dataSource, fileName, config);
                    loadCount++;
                    updateStatus(`📂 Loaded ${loadCount} specific surface(s) - ${config.name}`);
                    
                    // Auto-focus on first loaded surface
                    if (loadCount === 1) {
                        viewer.flyTo(dataSource);
                    }
                })
                .catch(function(error) {
                    console.log(`File not found: ${filePath}`);
                });
        }
    });
    
    // Update status after attempts
    setTimeout(() => {
        if (loadCount === 0) {
            updateStatus("⚠️ No horizontal/conical/takeoff surfaces found.");
        } else {
            updateStatus(`✅ Successfully loaded ${loadCount} specific surface(s)`);
        }
    }, 2000);
}

// Get obstacle type icon
function getObstacleTypeIcon(type) {
    const typeLower = type.toLowerCase();
    
    if (typeLower.includes('pylône') || typeLower.includes('tower') || typeLower.includes('antenna')) {
        return '📡';
    } else if (typeLower.includes('bâtiment') || typeLower.includes('building')) {
        return '🏢';
    } else if (typeLower.includes('aérogare') || typeLower.includes('terminal')) {
        return '✈️';
    } else if (typeLower.includes('hangar')) {
        return '🏗️';
    } else if (typeLower.includes('mât') || typeLower.includes('mast')) {
        return '📶';
    } else if (typeLower.includes('colline') || typeLower.includes('hill')) {
        return '⛰️';
    } else if (typeLower.includes('anémomètre') || typeLower.includes('capteur')) {
        return '🌀';
    } else if (typeLower.includes('véhicule') || typeLower.includes('vehicle')) {
        return '🚗';
    } else if (typeLower.includes('réservoir') || typeLower.includes('tank')) {
        return '🛢️';
    }
    
    return '⚠️';
}

// Highlight obstacle in viewer when clicked in panel
function highlightObstacleInViewer(coords, height) {
    // Find the obstacle entity and highlight it
    const obstacleDataSource = olsDataSources.get('obstacles');
    if (!obstacleDataSource) return;
    
    const entities = obstacleDataSource.entities.values;
    for (let i = 0; i < entities.length; i++) {
        const entity = entities[i];
        if (entity.position && entity.cylinder) {
            const cartographic = Cesium.Cartographic.fromCartesian(entity.position.getValue(Cesium.JulianDate.now()));
            const longitude = Cesium.Math.toDegrees(cartographic.longitude);
            const latitude = Cesium.Math.toDegrees(cartographic.latitude);
            
            // Check if this is the matching obstacle
            if (Math.abs(longitude - coords[0]) < 0.0001 && 
                Math.abs(latitude - coords[1]) < 0.0001) {
                
                // Highlight the obstacle
                const originalOutlineWidth = entity.cylinder.outlineWidth;
                entity.cylinder.outlineWidth = 6;
                entity.cylinder.outlineColor = Cesium.Color.fromCssColorString('#ffff00').withAlpha(1.0);
                
                // Fly to the obstacle
                viewer.flyTo(entity, {
                    offset: new Cesium.HeadingPitchRange(0, -0.5, 200)
                });
                
                // Reset highlight after 3 seconds
                setTimeout(() => {
                }, 3000);
                break;
            }
        }
    }
}

// Show obstacle info card with detailed information
function showObstacleInfoCard(obstacle, height) {
    const props = obstacle.properties;
    const coords = obstacle.geometry.coordinates;
    const obstacleType = props.obstacles || 'Unknown';
    
    // Update card title
    document.getElementById('info-card-title').innerHTML = `${getObstacleTypeIcon(obstacleType)} ${obstacleType}`;
    
    // Populate card content
    const content = document.getElementById('info-card-content');
    content.innerHTML = `
        <div class="info-row">
            <span class="info-label">Height</span>
            <span class="info-value info-height">${height.toFixed(1)} meters</span>
        </div>
        
        <div class="info-row">
            <span class="info-label">Type</span>
            <span class="info-value">${obstacleType}</span>
        </div>
        
        <div class="info-row">
            <span class="info-label">Altitude Data</span>
            <span class="info-value">${props.altitude_m || 'Not specified'}</span>
        </div>
        
        <div class="info-row">
            <span class="info-label">Coordinates</span>
            <div class="info-coordinates">
                Lat: ${coords[1].toFixed(6)}°<br>
                Lon: ${coords[0].toFixed(6)}°
            </div>
        </div>
        
        ${props.description ? `
        <div class="info-row">
            <span class="info-label">Description</span>
            <span class="info-value">${props.description}</span>
        </div>
        ` : ''}
        
        <div class="info-actions">
            <button class="info-action-btn" onclick="zoomToObstacle(${coords[0]}, ${coords[1]}, ${height})">
                🎯 Zoom to Location
            </button>
        </div>
    `;
    
    // Show the card
    document.getElementById('obstacle-info-card').style.display = 'block';
}

// Close obstacle info card
function closeObstacleInfoCard() {
    document.getElementById('obstacle-info-card').style.display = 'none';
}

// Zoom to specific obstacle
function zoomToObstacle(longitude, latitude, height) {
    const position = Cesium.Cartesian3.fromDegrees(longitude, latitude, height + 200);
    
    viewer.camera.flyTo({
        destination: position,
        orientation: {
            heading: Cesium.Math.toRadians(0.0),
            pitch: Cesium.Math.toRadians(-45.0),
            roll: 0
        },
        duration: 2.0
    });
    
    updateStatus(`Zoomed to obstacle at ${latitude.toFixed(6)}°, ${longitude.toFixed(6)}°`);
}

// Enhanced button click to show obstacle panel
function loadObstaclesWithPanel() {
    loadObstacles();
    setTimeout(() => {
        const panel = document.getElementById('obstacle-panel');
        panel.style.display = 'block';
    }, 1000);
}

// Load and style a specific OLS surface
function loadOLSSurface(dataSource, surfaceType, config) {
    viewer.dataSources.add(dataSource);
    olsDataSources.set(surfaceType, dataSource);
    
    // Style the entities
    const entities = dataSource.entities.values;
    for (let i = 0; i < entities.length; i++) {
        const entity = entities[i];
        
        // Style polygons
        if (entity.polygon) {
            entity.polygon.material = config.color.withAlpha(currentOpacity);
            entity.polygon.outline = true;
            entity.polygon.outlineColor = config.color.brighten(0.3, new Cesium.Color());
            entity.polygon.outlineWidth = 2;
            entity.polygon.height = 0;
            entity.polygon.extrudedHeight = undefined;
            entity.polygon.shadows = Cesium.ShadowMode.ENABLED;
            
            // Enhanced visual properties
            entity.polygon.classificationType = Cesium.ClassificationType.TERRAIN;
        }
        
        // Style polylines
        if (entity.polyline) {
            entity.polyline.material = config.color.withAlpha(0.9);
            entity.polyline.width = 3;
            entity.polyline.clampToGround = true;
            entity.polyline.shadows = Cesium.ShadowMode.ENABLED;
        }
        
        // Add entity name for identification
        entity.name = config.name;
        entity.description = `${config.name} - OLS Surface`;
    }
    
    console.log(`Loaded ${config.name} with ${entities.length} features`);
}

// Update opacity for all surfaces
function updateOpacity(opacity) {
    currentOpacity = parseFloat(opacity);
    
    olsDataSources.forEach((dataSource, surfaceType) => {
        if (surfaceType === 'obstacles') return; // Skip obstacles
        
        const config = olsConfig[surfaceType];
        if (!config) return;
        
        const entities = dataSource.entities.values;
        for (let i = 0; i < entities.length; i++) {
            const entity = entities[i];
            if (entity.polygon && entity.polygon.material) {
                entity.polygon.material = config.color.withAlpha(currentOpacity);
            }
        }
    });
}

// Reset camera to airport view
function resetToAirport() {
    // Focus on Tunis-Carthage Airport (TUN/DTTA)
    viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(10.2272, 36.8510, 1500), // Tunis airport coordinates with altitude
        orientation: {
            heading: Cesium.Math.toRadians(0.0),
            pitch: Cesium.Math.toRadians(-45.0),
            roll: 0.0
        }
    });
    updateStatus("📍 Centered on Tunis-Carthage Airport");
}

// Toggle terrain
function toggleTerrain() {
    const isTerrainEnabled = viewer.terrainProvider !== viewer.scene.globe.ellipsoid;
    
    if (isTerrainEnabled) {
        viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
        updateStatus("🏔️ Terrain disabled - flat surface");
    } else {
        viewer.terrainProvider = new Cesium.CesiumTerrainProvider({
            url: Cesium.IonResource.fromAssetId(1),
            requestWaterMask: true,
            requestVertexNormals: true
        });
        updateStatus("🏔️ Terrain enabled - real elevation data");
    }
}

// Toggle 2D/3D view
function toggle3D() {
    if (viewer.scene.mode === Cesium.SceneMode.SCENE3D) {
        viewer.scene.mode = Cesium.SceneMode.COLUMBUS_VIEW;
        updateStatus("📐 Switched to 2.5D view");
    } else {
        viewer.scene.mode = Cesium.SceneMode.SCENE3D;
        updateStatus("📐 Switched to 3D view");
    }
}

// Update status message
function updateStatus(message) {
    const statusElement = document.getElementById('status');
    if (statusElement) {
        statusElement.textContent = message;
        
        // Auto-clear status after 5 seconds for success messages
        if (message.includes('✅') || message.includes('📍') || message.includes('🏔️') || message.includes('📐')) {
            setTimeout(() => {
                statusElement.textContent = "Ready to load OLS data...";
            }, 5000);
        }
    }
}

// Keyboard shortcuts
document.addEventListener('keydown', function(event) {
    switch(event.key.toLowerCase()) {
        case 't':
            toggleTerrain();
            break;
        case 'r':
            loadAllOLSSurfaces();
            break;
        case 'h':
            resetToAirport();
            break;
        case 'c':
            clearAllSurfaces();
            break;
        case 'o':
            toggleObstaclePanel();
            break;
        case '3':
            toggle3D();
            break;
    }
});

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', function() {
    initializeViewer();
});
