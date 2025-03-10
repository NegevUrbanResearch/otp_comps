// enhanced-map-export-server.js
const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const app = express();
const port = 3000;

// Configure CORS with specific options
const corsOptions = {
  origin: '*', // Allow all origins during development
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
};

// Apply CORS middleware with options
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Enable JSON parsing with increased limit for large maps
app.use(express.json({ limit: '100mb' }));
app.use(express.static('public'));

// Define a simple test endpoint
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Enhanced map export server is running',
        endpoints: {
            root: '/',
            exportMapImage: '/export-map',
            exportInteractiveHTML: '/export-html',
            testImage: '/test-image'
        },
        corsStatus: 'enabled'
    });
});

// Test image endpoint
app.get('/test-image', (req, res) => {
    // Create a simple SVG image as a test
    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="300" height="200">
        <rect width="100%" height="100%" fill="#3498db"/>
        <text x="50%" y="50%" font-family="Arial" font-size="24" fill="white" text-anchor="middle" dominant-baseline="middle">
            Test Image
        </text>
    </svg>
    `;
    
    // Convert SVG to PNG using Puppeteer
    (async () => {
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.setContent(svg);
        const screenshot = await page.screenshot({ type: 'png' });
        await browser.close();
        
        res.contentType('image/png');
        res.send(screenshot);
    })();
});

// PNG image export endpoint
app.post('/export-map', async (req, res) => {
    let browser = null;
    
    try {
        console.log('Received PNG export request');
        
        // Extract parameters from the request
        const { 
            mapBounds, 
            center, 
            zoom, 
            size, 
            title, 
            subtitle, 
            basemap,
            analysisParams,
            analysisResults  // This is the key addition - receiving the actual analysis points
        } = req.body;
        
        if (!mapBounds || !center || !zoom || !size) {
            return res.status(400).send('Missing required parameters');
        }
        
        console.log('Launching browser for PNG export');
        console.log(`Received ${analysisResults?.length || 0} analysis points`);
        
        // Launch headless browser
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });
        
        const page = await browser.newPage();
        
        // Set viewport size - MODIFIED: remove the +180 additional space
        await page.setViewport({
            width: size.width,
            height: size.height,
            deviceScaleFactor: 2        // Higher resolution
        });
        
        // Create HTML content for the export, including analysis results
        const exportHtml = getExportTemplate({
            title,
            subtitle,
            basemap,
            mapBounds,
            center,
            zoom,
            size,
            analysisParams,
            analysisResults
        });
        
        // Set the HTML content
        await page.setContent(exportHtml, { waitUntil: 'networkidle0' });
        
        // Wait for map to fully render
        await page.waitForSelector('#export-map', { timeout: 20000 });
        await page.waitForFunction('window.mapReady === true', { timeout: 60000 });
        
        // Add a delay to ensure all elements are rendered
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Take a screenshot
        const screenshot = await page.screenshot({
            type: 'png',
            fullPage: true,
            omitBackground: false
        });
        
        console.log('Screenshot taken successfully');
        
        // Close the browser
        await browser.close();
        browser = null;
        
        // Send the image
        res.contentType('image/png');
        res.send(screenshot);
        
    } catch (error) {
        console.error('Error exporting map as PNG:', error);
        res.status(500).send(`Error exporting map: ${error.message}`);
    } finally {
        // Ensure browser is closed even if an error occurs
        if (browser) {
            await browser.close();
        }
    }
});

// NEW ENDPOINT: Interactive HTML export
app.post('/export-html', async (req, res) => {
    try {
        console.log('Received interactive HTML export request');
        
        // Extract parameters from the request
        const { 
            mapBounds, 
            center, 
            zoom, 
            size, 
            title, 
            subtitle, 
            basemap,
            analysisParams,
            analysisResults
        } = req.body;
        
        if (!mapBounds || !center || !zoom) {
            return res.status(400).send('Missing required parameters');
        }
        
        console.log(`Generating interactive HTML with ${analysisResults?.length || 0} analysis points`);
        
        // Create interactive HTML content
        const interactiveHtml = getInteractiveHtmlTemplate({
            title,
            subtitle,
            basemap,
            mapBounds,
            center,
            zoom,
            size: size || { width: 1000, height: 700 },
            analysisParams,
            analysisResults
        });
        
        // Send the HTML
        res.contentType('text/html');
        res.send(interactiveHtml);
        
        console.log('Interactive HTML sent successfully');
        
    } catch (error) {
        console.error('Error generating interactive HTML:', error);
        res.status(500).send(`Error generating interactive HTML: ${error.message}`);
    }
});

// Helper function to create the static export HTML template with analysis points
// Replace the getExportTemplate function in enhanced-map-export-server.js with this version

// Helper function to create the static export HTML template with analysis points
function getExportTemplate({ title, subtitle, basemap, mapBounds, center, zoom, size, analysisParams, analysisResults = [] }) {
    // Create JSON string of analysis results for the script
    const analysisResultsJSON = JSON.stringify(analysisResults)
        .replace(/</g, '\\u003c')  // Escape < to avoid script injection
        .replace(/>/g, '\\u003e'); // Escape > to avoid script injection
    
    return `
    <!DOCTYPE html>
    <html lang="en" style="margin:0; padding:0; height:100%;">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Map Export</title>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
        <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
        <style>
            html, body {
                margin: 0;
                padding: 0;
                height: 100%;
                width: 100%;
                overflow: hidden;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            }
            
            .export-container {
                width: 100%;
                height: 100%;
                display: flex;
                flex-direction: column;
                margin: 0;
                padding: 0;
            }
            
            .export-header {
                padding: 20px;
                background-color: #2c3e50;
                color: white;
                text-align: center;
                flex-shrink: 0;
            }
            
            #export-map {
                width: 100%;
                flex-grow: 1;
                margin: 0;
                padding: 0;
            }
            
            .export-title {
                margin: 0;
                font-size: 28px;
            }
            
            .export-subtitle {
                font-size: 16px;
                margin-top: 10px;
                opacity: 0.8;
            }
            
            .export-legend {
                position: absolute;
                bottom: 20px;
                right: 20px;
                background: rgba(22, 22, 22, 0.85);
                color: white;
                padding: 15px;
                border-radius: 8px;
                z-index: 1000;
                max-width: 330px;
            }
            
            .export-legend h3 {
                margin-top: 0;
                margin-bottom: 10px;
                font-size: 16px;
                text-align: center;
            }
            
            /* Add a params note overlay */
            .params-note {
                position: absolute;
                bottom: 20px;
                left: 20px;
                background: rgba(22, 22, 22, 0.75);
                color: white;
                padding: 10px;
                border-radius: 6px;
                font-size: 12px;
                z-index: 1000;
                max-width: 250px;
            }
        </style>
    </head>
    <body>
        <div class="export-container">
            <div class="export-header">
                <h1 class="export-title">${title || 'Hospital Accessibility Analysis'}</h1>
                <div class="export-subtitle">${subtitle || 'Comparing travel times between hospitals'}</div>
            </div>
            
            <div id="export-map"></div>
            
            <div class="export-legend">
                <h3>Travel Time Difference</h3>
                <div style="display: flex; flex-direction: column; background: rgba(40,40,40,0.85); padding: 10px; border-radius: 8px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                        <span style="font-size: 14px; font-weight: bold; color: #84b3ff;">Soroka Faster</span>
                        <span style="text-align: center; font-size: 14px; font-weight: bold; color: #e084ff;">Equal</span>
                        <span style="text-align: right; font-size: 14px; font-weight: bold; color: #ff8484;">Peres Faster</span>
                    </div>
                    
                    <div style="display: flex; height: 30px; width: 100%; border-radius: 5px; overflow: hidden; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">
                        <div style="flex: 1; background: linear-gradient(to right, #00008B, #0000FF, #8080FF, #C0C0FF, rgba(128, 0, 128, 0.9), #FFC0C0, #FF8080, #FF0000, #8B0000);"></div>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; font-size: 12px; margin-top: 8px; font-weight: bold;">
                        <span>15+ min</span>
                        <span>10 min</span>
                        <span>5 min</span>
                        <span style="color: #e084ff;">0 min</span>
                        <span>5 min</span>
                        <span>10 min</span>
                        <span>15+ min</span>
                    </div>
                    <div style="text-align: center; margin-top: 15px; font-size: 12px; opacity: 0.8;">
                        <em>Note: Peres location set at highway offramp, thus 2 minutes were added to all Peres Hospital trips</em>
                    </div>
                </div>
            </div>
            
            <!-- Add the params as a note overlay instead of a footer -->
            <div class="params-note">
                Analysis: ${analysisResults.length} points, Radius: ${analysisParams?.radius || 30}km, Grid: ${analysisParams?.gridSize || 1}km, Mode: ${analysisParams?.travelMode || 'Car'}, Generated: ${new Date().toLocaleDateString()}
            </div>
        </div>
        
        <script>
            // Initialize map
            const map = L.map('export-map', {
                attributionControl: true,
                zoomControl: false
            }).setView([${center.lat}, ${center.lng}], ${zoom});
            
            // Add basemap based on selection
            let tileLayer;
            switch ('${basemap}') {
                case 'light':
                    tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                    });
                    break;
                case 'satellite':
                    tileLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                    });
                    break;
                case 'dark':
                default:
                    tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                    });
                    break;
            }
            
            tileLayer.addTo(map);
            
            // Fix map container size
            setTimeout(() => {
                map.invalidateSize();
            }, 100);
            
            // Add hospital markers
            const soroka = [31.258048100012424, 34.800391059526504];
            const newHospital = [31.225231573088337, 34.828545558768404];
            
            // Create custom icons for hospitals
            const hospitalIcon = L.divIcon({
                className: 'hospital-marker',
                html: '<div style="background-color: #e74c3c; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>',
                iconSize: [16, 16],
                iconAnchor: [8, 8]
            });
            
            L.marker(soroka, {icon: hospitalIcon}).addTo(map)
                .bindPopup("<b>Soroka Medical Center</b><br>Major medical facility");
                
            L.marker(newHospital, {icon: hospitalIcon}).addTo(map)
                .bindPopup("<b>Peres Hospital</b><br>Planned facility");
            
            // Add radius circle around the analysis center
            const analysisCenter = [(soroka[0] + newHospital[0]) / 2, (soroka[1] + newHospital[1]) / 2];
            const analysisRadius = ${analysisParams?.radius || 30};
            
            L.circle(analysisCenter, {
                radius: analysisRadius * 1000,  // Convert km to meters
                color: '#2c3e50',
                fillColor: '#2c3e50',
                fillOpacity: 0.05,
                weight: 2,
                dashArray: '5,10'
            }).addTo(map);
            
            // Parse analysis results and add to map
            const analysisResults = ${analysisResultsJSON};
            const equalTimeThreshold = ${analysisParams?.equalTimeThreshold || 2};
            
            // Calculate max circle radius based on grid size and mode
            const gridSize = ${analysisParams?.gridSize || 1};

            const baseRadius = Math.min(gridSize * 350, 500);
            // Same overlap prevention for all modes
            const gridSizeMeters = ${analysisParams?.gridSize || 1} * 1000;
            const sizeMultiplier = 0.3; // Same multiplier for all modes
                        
            // Calculate maximum radius to prevent overlap
            const maxRadius = gridSizeMeters * sizeMultiplier;

            // Same maximum size for all modes
            const absoluteMaxRadius = 300;

            // Use the smallest of the calculated values
            const radius = Math.min(baseRadius, maxRadius, absoluteMaxRadius);
            
            if (analysisResults && analysisResults.length > 0) {
                console.log('Adding ' + analysisResults.length + ' analysis points to map');
                
                analysisResults.forEach(result => {
                    const { point, timeDiff, timeToSoroka, timeToPeres } = result;
                    
                    // Convert time difference from seconds to minutes for easier calculation
                    const diffMinutes = timeDiff / 60;
                    
                    let fillColor;
                    
                    // Create a continuous color spectrum based on the exact time difference
                    if (Math.abs(diffMinutes) < equalTimeThreshold) {
                        // Purple for equal access (within threshold)
                        fillColor = 'rgba(128, 0, 128, 0.7)';
                    } else {
                        // Calculate the normalized position on the color spectrum
                        // Cap at 15 minutes difference for full intensity
                        const maxDiff = 15; // Minutes difference for max intensity
                        
                        // Map the time difference to a value between 0 and 1
                        // Uses a non-linear (power) mapping for more dramatic color changes
                        const normalizedValue = Math.min(Math.abs(diffMinutes) / maxDiff, 1);
                        const adjustedValue = Math.pow(normalizedValue, 1.5); // Non-linear adjustment
                        
                        if (diffMinutes > 0) { // Peres Hospital is faster (red spectrum)
                            // Smooth transition from white to deep red
                            // More red as advantage increases
                            const red = 255;
                            const greenBlue = Math.max(0, Math.floor(255 * (1 - adjustedValue)));
                            fillColor = \`rgba(\${red}, \${greenBlue}, \${greenBlue}, 0.8)\`;
                        } else { // Soroka is faster (blue spectrum)
                            // Smooth transition from white to deep blue
                            // More blue as advantage increases
                            const blue = 255;
                            const redGreen = Math.max(0, Math.floor(255 * (1 - adjustedValue)));
                            fillColor = \`rgba(\${redGreen}, \${redGreen}, \${blue}, 0.8)\`;
                        }
                    }
                    
                    const radius = baseRadius
                    // Create circle for this analysis point
                    const circle = L.circle(point, {
                        radius: radius,
                        color: fillColor,         // Use same color for border
                        fillColor: fillColor,
                        fillOpacity: 0.8,
                        weight: 0                 // No outline
                    }).addTo(map);
                    
                    // Popup info
                    const sorokaTime = Math.round(timeToSoroka / 60);
                    const peresTime = Math.round(timeToPeres / 60);
                    const difference = Math.abs(Math.round(timeDiff / 60));
                    
                    let fasterHospital;
                    if (Math.abs(timeDiff) < equalTimeThreshold * 60) {
                        fasterHospital = \`Equal access (< \${equalTimeThreshold} min difference)\`;
                    } else if (timeDiff > 0) {
                        fasterHospital = \`Peres Hospital is faster by \${difference} min\`;
                    } else {
                        fasterHospital = \`Soroka is faster by \${difference} min\`;
                    }
                    
                    circle.bindPopup(\`
                        <strong>Access Times:</strong><br>
                        Soroka Medical Center: \${sorokaTime} minutes<br>
                        Peres Hospital: \${peresTime} minutes<br>
                        <strong>\${fasterHospital}</strong>
                    \`);
                });
                
                // Fit map bounds based on analysis results if needed
                // map.fitBounds(L.latLngBounds(analysisResults.map(r => r.point)));
            } else {
                console.log('No analysis results to display');
            }
            
            // Set the bounds
            map.fitBounds([
                [${mapBounds.south}, ${mapBounds.west}],
                [${mapBounds.north}, ${mapBounds.east}]
            ]);
            
            // Wait for all tiles to load
            let tilesLoaded = false;
            tileLayer.on('load', function() {
                tilesLoaded = true;
                checkMapReady();
            });
            
            // Helper function to check if map is ready for screenshot
            function checkMapReady() {
                if (tilesLoaded) {
                    // Signal that the map is ready for screenshot
                    window.mapReady = true;
                }
            }
            
            // If tiles don't load after 10 seconds, proceed anyway
            setTimeout(() => {
                window.mapReady = true;
            }, 10000);
        </script>
    </body>
    </html>
    `;
}

// Helper function to create interactive HTML template
function getInteractiveHtmlTemplate({ title, subtitle, basemap, mapBounds, center, zoom, size, analysisParams, analysisResults = [] }) {
    // Create JSON string of analysis results for the script
    const analysisResultsJSON = JSON.stringify(analysisResults)
        .replace(/</g, '\\u003c')  // Escape < to avoid script injection
        .replace(/>/g, '\\u003e'); // Escape > to avoid script injection
    
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title || 'Hospital Accessibility Analysis'}</title>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
        <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
        <style>
            body {
                margin: 0;
                padding: 0;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background-color: #f8f9fa;
            }
            
            .container {
                display: flex;
                flex-direction: column;
                height: 100vh;
            }
            
            .header {
                padding: 20px;
                background-color: #2c3e50;
                color: white;
                text-align: center;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
            }
            
            .content {
                flex: 1;
                display: flex;
                flex-direction: row;
            }
            
            .sidebar {
                width: 300px;
                background-color: white;
                padding: 20px;
                overflow-y: auto;
                box-shadow: 2px 0 10px rgba(0, 0, 0, 0.1);
            }
            
            #interactive-map {
                flex: 1;
                height: 100%;
            }
            
            h1 {
                margin: 0;
                font-size: 24px;
            }
            
            .subtitle {
                font-size: 14px;
                margin-top: 8px;
                opacity: 0.8;
            }
            
            .legend {
                position: absolute;
                bottom: 30px;
                right: 30px;
                background: rgba(22, 22, 22, 0.85);
                color: white;
                padding: 15px;
                border-radius: 8px;
                z-index: 1000;
                max-width: 300px;
                backdrop-filter: blur(3px);
            }
            
            .legend h3 {
                margin-top: 0;
                margin-bottom: 10px;
                font-size: 16px;
                text-align: center;
            }
            
            .info-box {
                background-color: #f8f9fa;
                border-radius: 8px;
                padding: 15px;
                margin-bottom: 20px;
            }
            
            .info-title {
                font-weight: bold;
                margin-bottom: 8px;
                color: #2c3e50;
            }
            
            .info-value {
                margin-bottom: 5px;
            }
            
            .stat-box {
                display: flex;
                flex-direction: column;
                background-color: #eef2f7;
                border-radius: 8px;
                padding: 12px;
                margin-bottom: 10px;
            }
            
            .stat-title {
                font-size: 12px;
                color: #7f8c8d;
            }
            
            .stat-value {
                font-size: 18px;
                font-weight: bold;
                color: #2c3e50;
            }
            
            /* Base styles for mobile */
            @media (max-width: 768px) {
                .content {
                    flex-direction: column;
                }
                
                .sidebar {
                    width: 100%;
                    max-height: 200px;
                }
                
                .legend {
                    bottom: 10px;
                    right: 10px;
                    max-width: 250px;
                }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>${title || 'Hospital Accessibility Analysis'}</h1>
                <div class="subtitle">${subtitle || 'Comparing travel times between hospitals'}</div>
            </div>
            
            <div class="content">
                <div class="sidebar">
                    <div class="info-box">
                        <div class="info-title">Analysis Parameters</div>
                        <div class="info-value">Radius: ${analysisParams?.radius || 30} km</div>
                        <div class="info-value">Grid Size: ${analysisParams?.gridSize || 1} km</div>
                        <div class="info-value">Travel Mode: ${analysisParams?.travelMode || 'Car'}</div>
                    </div>
                    
                    <div class="stat-boxes">
                        <div class="info-title">Statistics</div>
                        <div class="stat-box">
                            <div class="stat-title">Total Points Analyzed</div>
                            <div class="stat-value" id="total-points">Loading...</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-title">Grid Areas with Faster Access to Soroka</div>
                            <div class="stat-value" id="soroka-faster">Loading...</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-title">Grid Areas with Faster Access to Peres</div>
                            <div class="stat-value" id="peres-faster">Loading...</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-title">Grid Areas with Approximately Equal Access</div>
                            <div class="stat-value" id="equal-access">Loading...</div>
                        </div>
                    </div>
                </div>
                
                <div id="interactive-map"></div>
            </div>
        </div>
        
        <div class="legend">
            <h3>Travel Time Difference</h3>
            <div style="display: flex; flex-direction: column; background: rgba(40,40,40,0.85); padding: 10px; border-radius: 8px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <span style="font-size: 14px; font-weight: bold; color: #84b3ff;">Soroka Faster</span>
                    <span style="text-align: center; font-size: 14px; font-weight: bold; color: #e084ff;">Equal</span>
                    <span style="text-align: right; font-size: 14px; font-weight: bold; color: #ff8484;">Peres Faster</span>
                </div>
                
                <div style="display: flex; height: 30px; width: 100%; border-radius: 5px; overflow: hidden; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">
                    <div style="flex: 1; background: linear-gradient(to right, #00008B, #0000FF, #8080FF, #C0C0FF, rgba(128, 0, 128, 0.9), #FFC0C0, #FF8080, #FF0000, #8B0000);"></div>
                </div>
                
                <div style="display: flex; justify-content: space-between; font-size: 12px; margin-top: 8px; font-weight: bold;">
                    <span>15+ min</span>
                    <span>10 min</span>
                    <span>5 min</span>
                    <span style="color: #e084ff;">0 min</span>
                    <span>5 min</span>
                    <span>10 min</span>
                    <span>15+ min</span>
                </div>
                <div style="text-align: center; margin-top: 10px; font-size: 12px; opacity: 0.8;">
                    <em>Note: Peres location set at highway offramp, thus 2 minutes were added to all Peres Hospital trips</em>
                </div>
            </div>
        </div>
        
        <script>
            // Initialize map
            const map = L.map('interactive-map', {
                attributionControl: true,
                zoomControl: true
            }).setView([${center.lat}, ${center.lng}], ${zoom});
            
            // Add basemap based on selection
            let tileLayer;
            switch ('${basemap}') {
                case 'light':
                    tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                    });
                    break;
                case 'satellite':
                    tileLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                    });
                    break;
                case 'dark':
                default:
                    tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                    });
                    break;
            }
            
            tileLayer.addTo(map);
            
            // Add layer control for basemaps
            const baseLayers = {
                "Dark": L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                }),
                "Light": L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                }),
                "Satellite": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                })
            };
            
            // Add currently active layer
            if ('${basemap}' === 'light') {
                map.removeLayer(tileLayer);
                baseLayers["Light"].addTo(map);
            } else if ('${basemap}' === 'satellite') {
                map.removeLayer(tileLayer);
                baseLayers["Satellite"].addTo(map);
            } else {
                // Keep dark as default
                baseLayers["Dark"] = tileLayer;
            }
            
            L.control.layers(baseLayers).addTo(map);
            
            // Add hospital markers
            const soroka = [31.258048100012424, 34.800391059526504];
            const newHospital = [31.225231573088337, 34.828545558768404];
            
            // Create custom icons for hospitals
            const hospitalIcon = L.divIcon({
                className: 'hospital-marker',
                html: '<div style="background-color: #e74c3c; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>',
                iconSize: [16, 16],
                iconAnchor: [8, 8]
            });
            
            L.marker(soroka, {icon: hospitalIcon}).addTo(map)
                .bindPopup("<b>Soroka Medical Center</b><br>Major medical facility");
                
            L.marker(newHospital, {icon: hospitalIcon}).addTo(map)
                .bindPopup("<b>Peres Hospital</b><br>Planned facility");
            
            // Add radius circle around the analysis center
            const analysisCenter = [(soroka[0] + newHospital[0]) / 2, (soroka[1] + newHospital[1]) / 2];
            const analysisRadius = ${analysisParams?.radius || 30};
            
            L.circle(analysisCenter, {
                radius: analysisRadius * 1000,  // Convert km to meters
                color: '#2c3e50',
                fillColor: '#2c3e50',
                fillOpacity: 0.05,
                weight: 2,
                dashArray: '5,10'
            }).addTo(map);
            
            // Parse analysis results and add to map
            const analysisResults = ${analysisResultsJSON};
            const equalTimeThreshold = ${analysisParams?.equalTimeThreshold || 2};
            
            // Calculate max circle radius based on grid size and mode
            const gridSize = ${analysisParams?.gridSize || 1};
            
            const baseRadius = Math.min(gridSize * 350, 500);
            // Same overlap prevention for all modes
            const gridSizeMeters = ${analysisParams?.gridSize || 1} * 1000;
            const sizeMultiplier = 0.3; // Same multiplier for all modes
                        
            // Calculate maximum radius to prevent overlap
            const maxRadius = gridSizeMeters * sizeMultiplier;
            
            // Same maximum size for all modes
            const absoluteMaxRadius = 300;
            
            // Use the smallest of the calculated values
            const radius = Math.min(baseRadius, maxRadius, absoluteMaxRadius);
            
            // Statistics counters
            let sorokaFasterCount = 0;
            let peresFasterCount = 0;
            let equalAccessCount = 0;
            
            if (analysisResults && analysisResults.length > 0) {
                console.log('Adding ' + analysisResults.length + ' analysis points to map');
                
                // Analysis results layer
                const resultsLayer = L.layerGroup().addTo(map);
                
                analysisResults.forEach(result => {
                    const { point, timeDiff, timeToSoroka, timeToPeres } = result;
                    
                    // Convert time difference from seconds to minutes for easier calculation
                    const diffMinutes = timeDiff / 60;
                    
                    let fillColor;
                    
                    // Update statistics
                    if (Math.abs(diffMinutes) < equalTimeThreshold) {
                        equalAccessCount++;
                    } else if (diffMinutes > 0) {
                        peresFasterCount++;
                    } else {
                        sorokaFasterCount++;
                    }
                    
                    // Create a continuous color spectrum based on the exact time difference
                    if (Math.abs(diffMinutes) < equalTimeThreshold) {
                        // Purple for equal access (within threshold)
                        fillColor = 'rgba(128, 0, 128, 0.7)';
                    } else {
                        // Calculate the normalized position on the color spectrum
                        // Cap at 15 minutes difference for full intensity
                        const maxDiff = 15; // Minutes difference for max intensity
                        
                        // Map the time difference to a value between 0 and 1
                        // Uses a non-linear (power) mapping for more dramatic color changes
                        const normalizedValue = Math.min(Math.abs(diffMinutes) / maxDiff, 1);
                        const adjustedValue = Math.pow(normalizedValue, 1.5); // Non-linear adjustment
                        
                        if (diffMinutes > 0) { // Peres Hospital is faster (red spectrum)
                            // Smooth transition from white to deep red
                            // More red as advantage increases
                            const red = 255;
                            const greenBlue = Math.max(0, Math.floor(255 * (1 - adjustedValue)));
                            fillColor = \`rgba(\${red}, \${greenBlue}, \${greenBlue}, 0.8)\`;
                        } else { // Soroka is faster (blue spectrum)
                            // Smooth transition from white to deep blue
                            // More blue as advantage increases
                            const blue = 255;
                            const redGreen = Math.max(0, Math.floor(255 * (1 - adjustedValue)));
                            fillColor = \`rgba(\${redGreen}, \${redGreen}, \${blue}, 0.8)\`;
                        }
                    }
                    
                    const radius = baseRadius 
                    
                    // Create circle for this analysis point
                    const circle = L.circle(point, {
                        radius: radius,
                        color: fillColor,         // Use same color for border
                        fillColor: fillColor,
                        fillOpacity: 0.8,
                        weight: 0                 // No outline
                    }).addTo(resultsLayer);
                    
                    // Popup info
                    const sorokaTime = Math.round(timeToSoroka / 60);
                    const peresTime = Math.round(timeToPeres / 60);
                    const difference = Math.abs(Math.round(timeDiff / 60));
                    
                    let fasterHospital;
                    if (Math.abs(timeDiff) < equalTimeThreshold * 60) {
                        fasterHospital = \`Equal access (< \${equalTimeThreshold} min difference)\`;
                    } else if (timeDiff > 0) {
                        fasterHospital = \`Peres Hospital is faster by \${difference} min\`;
                    } else {
                        fasterHospital = \`Soroka is faster by \${difference} min\`;
                    }
                    
                    circle.bindPopup(\`
                        <strong>Access Times:</strong><br>
                        Soroka Medical Center: \${sorokaTime} minutes<br>
                        Peres Hospital: \${peresTime} minutes<br>
                        <strong>\${fasterHospital}</strong>
                    \`);
                });
                
                // Add control to toggle analysis layer
                const overlays = {
                    "Analysis Results": resultsLayer
                };
                
                L.control.layers(baseLayers, overlays, { position: 'topright' }).addTo(map);
                
                // Update statistics in sidebar
                document.getElementById('total-points').textContent = analysisResults.length;
                document.getElementById('soroka-faster').textContent = sorokaFasterCount + " (" + 
                    Math.round((sorokaFasterCount / analysisResults.length) * 100) + "%)";
                document.getElementById('peres-faster').textContent = peresFasterCount + " (" + 
                    Math.round((peresFasterCount / analysisResults.length) * 100) + "%)";
                document.getElementById('equal-access').textContent = equalAccessCount + " (" + 
                    Math.round((equalAccessCount / analysisResults.length) * 100) + "%)";
            } else {
                console.log('No analysis results to display');
                
                // Update statistics with zeros
                document.getElementById('total-points').textContent = "0";
                document.getElementById('soroka-faster').textContent = "0 (0%)";
                document.getElementById('peres-faster').textContent = "0 (0%)";
                document.getElementById('equal-access').textContent = "0 (0%)";
            }
            
            // Set the bounds
            map.fitBounds([
                [${mapBounds.south}, ${mapBounds.west}],
                [${mapBounds.north}, ${mapBounds.east}]
            ]);
        </script>
    </body>
    </html>
    `;
}

// Start the server
app.listen(port, () => {
    console.log(`Enhanced map export server running at http://localhost:${port}`);
    console.log(`- Test endpoint: http://localhost:${port}/`);
    console.log(`- Test image: http://localhost:${port}/test-image`);
    console.log(`- PNG export endpoint: http://localhost:${port}/export-map (POST)`);
    console.log(`- HTML export endpoint: http://localhost:${port}/export-html (POST)`);
});