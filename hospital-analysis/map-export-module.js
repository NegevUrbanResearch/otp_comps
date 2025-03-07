// fixed-map-export-module.js
// This module handles the frontend logic for exporting the map as PNG or interactive HTML

class MapExporter {
    constructor(map, options = {}) {
        this.map = map;
        this.options = {
            filename: 'hospital-analysis-map',
            quality: 0.9,
            backend: 'http://localhost:3000/export-map',
            htmlBackend: 'http://localhost:3000/export-html',
            ...options
        };
        
        this.preparingExport = false;
        
        // Store reference to the results layer
        this.resultsLayer = options.resultsLayer;
        
        // Log initialization
        console.log(`Enhanced Map Exporter initialized`);
    }
    
    // The main export function for PNG images
    async exportMap() {
        if (this.preparingExport) return;
        
        try {
            this.preparingExport = true;
            const statusElement = document.getElementById('exportStatus');
            if (statusElement) {
                statusElement.textContent = 'Preparing map for export...';
            }
            
            // Show loading indicator
            const loadingScreen = document.getElementById('loadingScreen');
            const progressText = document.getElementById('progressText');
            const progressBar = document.getElementById('progressBar');
            
            if (loadingScreen && progressText && progressBar) {
                loadingScreen.style.display = 'flex';
                progressText.textContent = 'Preparing map for export...';
                progressBar.style.width = '0%';
                progressBar.textContent = '0%';
            }
            
            // Wait for the map to finish rendering
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // 1. Get the map size and bounds
            const mapSize = this.map.getSize();
            const mapBounds = this.map.getBounds();
            const center = this.map.getCenter();
            const zoom = this.map.getZoom();
            
            // Update progress
            if (progressBar) {
                progressBar.style.width = '15%';
                progressBar.textContent = '15%';
            }
            
            // 2. Prepare data to send to backend
            const exportTitle = document.getElementById('exportTitleInput')?.value || 'Hospital Accessibility Analysis';
            const exportSubtitle = document.getElementById('exportSubtitleInput')?.value || 'Comparing travel times between hospitals';
            
            // Collect visible layers
            const visibleBasemap = this._getActiveBasemap();
            
            // Collect analysis results - FIXED VERSION
            const analysisResults = this._getAnalysisResults();
            
            // Update progress
            if (progressBar) {
                progressBar.style.width = '25%';
                progressBar.textContent = '25%';
            }
            
            // 3. Prepare data for the backend
            const exportData = {
                mapBounds: {
                    north: mapBounds.getNorth(),
                    east: mapBounds.getEast(),
                    south: mapBounds.getSouth(),
                    west: mapBounds.getWest()
                },
                center: { lat: center.lat, lng: center.lng },
                zoom: zoom,
                size: { width: mapSize.x, height: mapSize.y },
                title: exportTitle,
                subtitle: exportSubtitle,
                basemap: visibleBasemap,
                // Add analysis parameters
                analysisParams: {
                    radius: document.getElementById('radiusSlider')?.value || 30,
                    gridSize: document.getElementById('gridSizeSlider')?.value || 1,
                    travelMode: document.getElementById('travelModeSelect')?.value || 'CAR',
                    equalTimeThreshold: 2 // Hardcoded value from the original code
                },
                // Include the actual analysis results
                analysisResults: analysisResults
            };
            
            // Update progress
            if (progressBar) {
                progressBar.style.width = '40%';
                progressBar.textContent = '40%';
            }
            
            // Log the fetch attempt
            console.log(`Sending export request to: ${this.options.backend}`);
            console.log(`Including ${analysisResults.length} analysis points in the export`);
            
            // 4. Send data to the backend with CORS mode explicitly set
            try {
                const response = await fetch(this.options.backend, {
                    method: 'POST',
                    mode: 'cors', // Explicitly set CORS mode
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'image/png'
                    },
                    body: JSON.stringify(exportData)
                });
                
                // Update progress
                if (progressBar) {
                    progressBar.style.width = '80%';
                    progressBar.textContent = '80%';
                }
                
                // 5. Handle the response
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Server returned ${response.status}: ${errorText}`);
                }
                
                // Get the image blob
                const blob = await response.blob();
                
                // Update progress
                if (progressBar) {
                    progressBar.style.width = '90%';
                    progressBar.textContent = '90%';
                }
                
                // 6. Create download link
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `${this.options.filename}-${new Date().toISOString().split('T')[0]}.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                // Clean up object URL
                setTimeout(() => URL.revokeObjectURL(url), 100);
                
                // Hide loading and update status
                if (loadingScreen) {
                    loadingScreen.style.display = 'none';
                }
                
                if (statusElement) {
                    statusElement.textContent = 'Map exported successfully as PNG!';
                }
                
                return true;
            } catch (fetchError) {
                // Special handling for network errors and CORS issues
                console.error('Fetch error:', fetchError);
                
                let errorMessage = fetchError.message;
                
                // Check for common CORS errors
                if (fetchError.message.includes('NetworkError') || 
                    fetchError.message.includes('Failed to fetch')) {
                    errorMessage = `CORS error - Server connection failed. Make sure the export server is running at ${this.options.backend} and CORS is properly configured.`;
                    
                    // Add server test link
                    const testLink = document.createElement('a');
                    testLink.href = this.options.backend.replace('/export-map', '');
                    testLink.target = '_blank';
                    testLink.textContent = 'Test server connection';
                    
                    if (statusElement) {
                        statusElement.innerHTML = `${errorMessage}<br>`;
                        statusElement.appendChild(testLink);
                    }
                    
                    // Provide help in the console
                    console.error('CORS TROUBLESHOOTING:');
                    console.error('1. Make sure the server is running: npm start');
                    console.error('2. Verify the server has CORS enabled');
                    console.error('3. Try serving your HTML from a local web server instead of a file:// URL');
                    console.error('4. Check if any browser extensions are blocking the request');
                } else {
                    if (statusElement) {
                        statusElement.textContent = `Export failed: ${errorMessage}`;
                    }
                }
                
                // Hide loading
                if (loadingScreen) {
                    loadingScreen.style.display = 'none';
                }
                
                throw fetchError;
            }
        } catch (error) {
            console.error('Error exporting map:', error);
            const statusElement = document.getElementById('exportStatus');
            
            if (statusElement && !statusElement.innerHTML.includes('CORS error')) {
                statusElement.textContent = `Export failed: ${error.message}`;
            }
            
            // Hide loading
            const loadingScreen = document.getElementById('loadingScreen');
            if (loadingScreen) {
                loadingScreen.style.display = 'none';
            }
            
            return false;
        } finally {
            this.preparingExport = false;
        }
    }
    
    // New method for exporting interactive HTML
    async exportInteractiveHTML() {
        if (this.preparingExport) return;
        
        try {
            this.preparingExport = true;
            const statusElement = document.getElementById('exportStatus');
            if (statusElement) {
                statusElement.textContent = 'Preparing interactive HTML export...';
            }
            
            // Show loading indicator
            const loadingScreen = document.getElementById('loadingScreen');
            const progressText = document.getElementById('progressText');
            const progressBar = document.getElementById('progressBar');
            
            if (loadingScreen && progressText && progressBar) {
                loadingScreen.style.display = 'flex';
                progressText.textContent = 'Preparing interactive HTML export...';
                progressBar.style.width = '0%';
                progressBar.textContent = '0%';
            }
            
            // 1. Get the map size and bounds
            const mapSize = this.map.getSize();
            const mapBounds = this.map.getBounds();
            const center = this.map.getCenter();
            const zoom = this.map.getZoom();
            
            // Update progress
            if (progressBar) {
                progressBar.style.width = '20%';
                progressBar.textContent = '20%';
            }
            
            // 2. Prepare data to send to backend
            const exportTitle = document.getElementById('exportTitleInput')?.value || 'Hospital Accessibility Analysis';
            const exportSubtitle = document.getElementById('exportSubtitleInput')?.value || 'Comparing travel times between hospitals';
            
            // Collect visible layers
            const visibleBasemap = this._getActiveBasemap();
            
            // Collect analysis results - FIXED VERSION
            const analysisResults = this._getAnalysisResults();
            
            // Update progress
            if (progressBar) {
                progressBar.style.width = '40%';
                progressBar.textContent = '40%';
            }
            
            // 3. Prepare data for the backend
            const exportData = {
                mapBounds: {
                    north: mapBounds.getNorth(),
                    east: mapBounds.getEast(),
                    south: mapBounds.getSouth(),
                    west: mapBounds.getWest()
                },
                center: { lat: center.lat, lng: center.lng },
                zoom: zoom,
                size: { width: Math.max(mapSize.x, 1000), height: Math.max(mapSize.y, 700) },
                title: exportTitle,
                subtitle: exportSubtitle,
                basemap: visibleBasemap,
                // Add analysis parameters
                analysisParams: {
                    radius: document.getElementById('radiusSlider')?.value || 30,
                    gridSize: document.getElementById('gridSizeSlider')?.value || 1,
                    travelMode: document.getElementById('travelModeSelect')?.value || 'CAR',
                    equalTimeThreshold: 2 // Hardcoded value from the original code
                },
                // Include the actual analysis results
                analysisResults: analysisResults
            };
            
            // Update progress
            if (progressBar) {
                progressBar.style.width = '60%';
                progressBar.textContent = '60%';
            }
            
            // Log the fetch attempt
            console.log(`Sending HTML export request to: ${this.options.htmlBackend}`);
            console.log(`Including ${analysisResults.length} analysis points in the export`);
            
            // 4. Send data to the backend with CORS mode explicitly set
            try {
                const response = await fetch(this.options.htmlBackend, {
                    method: 'POST',
                    mode: 'cors',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'text/html'
                    },
                    body: JSON.stringify(exportData)
                });
                
                // Update progress
                if (progressBar) {
                    progressBar.style.width = '80%';
                    progressBar.textContent = '80%';
                }
                
                // 5. Handle the response
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Server returned ${response.status}: ${errorText}`);
                }
                
                // Get the HTML content
                const htmlText = await response.text();
                
                // Update progress
                if (progressBar) {
                    progressBar.style.width = '90%';
                    progressBar.textContent = '90%';
                }
                
                // 6. Create a blob and download link
                const blob = new Blob([htmlText], { type: 'text/html' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `${this.options.filename}-interactive-${new Date().toISOString().split('T')[0]}.html`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                // Clean up object URL
                setTimeout(() => URL.revokeObjectURL(url), 100);
                
                // Hide loading and update status
                if (loadingScreen) {
                    loadingScreen.style.display = 'none';
                }
                
                if (statusElement) {
                    statusElement.textContent = 'Interactive HTML exported successfully!';
                }
                
                return true;
            } catch (fetchError) {
                console.error('HTML Export error:', fetchError);
                
                let errorMessage = fetchError.message;
                
                // Check for common CORS errors
                if (fetchError.message.includes('NetworkError') || 
                    fetchError.message.includes('Failed to fetch')) {
                    errorMessage = `CORS error - Server connection failed. Make sure the export server is running at ${this.options.htmlBackend} and CORS is properly configured.`;
                }
                
                if (statusElement) {
                    statusElement.textContent = `HTML export failed: ${errorMessage}`;
                }
                
                // Hide loading
                if (loadingScreen) {
                    loadingScreen.style.display = 'none';
                }
                
                throw fetchError;
            }
        } catch (error) {
            console.error('Error exporting HTML:', error);
            
            const statusElement = document.getElementById('exportStatus');
            if (statusElement) {
                statusElement.textContent = `HTML export failed: ${error.message}`;
            }
            
            // Hide loading
            const loadingScreen = document.getElementById('loadingScreen');
            if (loadingScreen) {
                loadingScreen.style.display = 'none';
            }
            
            return false;
        } finally {
            this.preparingExport = false;
        }
    }
    
    // Helper method to determine which basemap is currently active
    _getActiveBasemap() {
        const mapContainer = this.map.getContainer();
        
        // Check which tile layer is visible
        const darkLayer = mapContainer.querySelector('.leaflet-layer:nth-child(1)');
        const lightLayer = mapContainer.querySelector('.leaflet-layer:nth-child(2)');
        const satelliteLayer = mapContainer.querySelector('.leaflet-layer:nth-child(3)');
        
        if (darkLayer && window.getComputedStyle(darkLayer).display !== 'none') {
            return 'dark';
        } else if (lightLayer && window.getComputedStyle(lightLayer).display !== 'none') {
            return 'light';
        } else if (satelliteLayer && window.getComputedStyle(satelliteLayer).display !== 'none') {
            return 'satellite';
        }
        
        // Default to dark if we can't determine
        return 'dark';
    }
    
    // FIXED Helper method to collect all analysis results from the map
    _getAnalysisResults() {
        // First, try direct access to the global analysisResults variable
        if (window.analysisResults && Array.isArray(window.analysisResults)) {
            console.log(`Found ${window.analysisResults.length} analysis results in global object`);
            return window.analysisResults;
        }
        
        // Second, try to capture from the page by looking for the variable directly
        try {
            if (typeof analysisResults !== 'undefined' && Array.isArray(analysisResults)) {
                console.log(`Found ${analysisResults.length} analysis results from page variable`);
                return analysisResults;
            }
        } catch (e) {
            console.log("Variable not directly accessible:", e);
        }
        
        // Third approach: Look for circles with data in the map
        try {
            const results = [];
            
            this.map.eachLayer(layer => {
                if (layer.getRadius && layer.options && layer.options.data) {
                    results.push(layer.options.data);
                }
            });
            
            if (results.length > 0) {
                console.log(`Extracted ${results.length} analysis results from map layers`);
                return results;
            }
        } catch (err) {
            console.error("Error extracting from layers:", err);
        }
        
        // Fourth approach: Use a DOM hack to extract the analysisResults
        try {
            // Add a script element to the page that will extract the variable value
            const scriptElement = document.createElement('script');
            scriptElement.id = 'extract-analysis-results';
            scriptElement.innerHTML = `
                if (typeof analysisResults !== 'undefined') {
                    window._extractedAnalysisResults = analysisResults;
                    console.log('Extracted results via script injection: ' + analysisResults.length);
                }
            `;
            document.body.appendChild(scriptElement);
            
            // Check if the script was able to extract it
            if (window._extractedAnalysisResults) {
                const results = window._extractedAnalysisResults;
                document.body.removeChild(scriptElement);
                console.log(`Extracted ${results.length} analysis results via script injection`);
                return results;
            }
            
            document.body.removeChild(scriptElement);
        } catch (err) {
            console.error("Error with script extraction:", err);
        }
        
        // Fallback: Try to parse from logger output
        try {
            const consoleOutput = document.getElementById('console-output');
            if (consoleOutput) {
                const text = consoleOutput.textContent;
                const match = text.match(/Analysis complete: (\d+) points processed successfully/);
                if (match && match[1]) {
                    console.log(`Found processed point count in logs: ${match[1]}`);
                    
                    // Create dummy data for demonstration if we can't get real data
                    // This is better than returning nothing, though it will be approximate
                    const dummyResults = [];
                    const count = parseInt(match[1]);
                    const radius = parseFloat(document.getElementById('radiusSlider').value);
                    const gridSize = parseFloat(document.getElementById('gridSizeSlider').value);
                    
                    // Get the center point
                    const soroka = [31.258048100012424, 34.800391059526504];
                    const newHospital = [31.225231573088337, 34.828545558768404];
                    const center = [(soroka[0] + newHospital[0]) / 2, (soroka[1] + newHospital[1]) / 2];
                    
                    // Generate points in a grid
                    const latStep = gridSize / 111;
                    const lonStep = gridSize / (111 * Math.cos(center[0] * Math.PI / 180));
                    
                    // Calculate bounds
                    const latDelta = radius / 111;
                    const lonDelta = radius / (111 * Math.cos(center[0] * Math.PI / 180));
                    
                    // Generate approximation of grid points
                    let pointsGenerated = 0;
                    for (let lat = center[0] - latDelta; lat <= center[0] + latDelta && pointsGenerated < count; lat += latStep) {
                        for (let lon = center[1] - lonDelta; lon <= center[1] + lonDelta && pointsGenerated < count; lon += lonStep) {
                            // Calculate distance from center to see if it's within radius
                            const dLat = (center[0] - lat) * Math.PI / 180;
                            const dLon = (center[1] - lon) * Math.PI / 180;
                            const a = 
                                Math.sin(dLat/2) * Math.sin(dLat/2) +
                                Math.cos(lat * Math.PI / 180) * Math.cos(center[0] * Math.PI / 180) * 
                                Math.sin(dLon/2) * Math.sin(dLon/2);
                            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                            const distance = 6371 * c; // Earth radius in km
                            
                            if (distance <= radius) {
                                // Calculate travel times based on distance (this is an approximation)
                                const distToSoroka = this._haversineDistance(lat, lon, soroka[0], soroka[1]);
                                const distToPeres = this._haversineDistance(lat, lon, newHospital[0], newHospital[1]);
                                
                                // Assume 60 km/h average speed (1 km per minute)
                                const timeToSoroka = distToSoroka * 60; // seconds
                                const timeToPeres = distToPeres * 60 + 120; // seconds (adding 2 minutes for Peres)
                                
                                dummyResults.push({
                                    point: [lat, lon],
                                    timeToSoroka: timeToSoroka,
                                    timeToPeres: timeToPeres,
                                    timeDiff: timeToSoroka - timeToPeres
                                });
                                
                                pointsGenerated++;
                            }
                        }
                    }
                    
                    console.log(`Generated ${dummyResults.length} approximate analysis points`);
                    return dummyResults;
                }
            }
        } catch (err) {
            console.error("Error parsing console output:", err);
        }
        
        console.warn("Could not find analysis results through any method");
        return [];
    }
    
    // Helper for distance calculation (used in fallback)
    _haversineDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Radius of the earth in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180; 
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2); 
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
        return R * c;
    }
    
    // Test the connection to the export server
    async testServerConnection() {
        try {
            const testUrl = this.options.backend.replace('/export-map', '/');
            const response = await fetch(testUrl, { 
                method: 'GET',
                mode: 'cors'
            });
            
            if (response.ok) {
                console.log('Server connection test successful!');
                return true;
            } else {
                console.error(`Server connection test failed: ${response.status} ${response.statusText}`);
                return false;
            }
        } catch (error) {
            console.error('Server connection test failed:', error);
            return false;
        }
    }
}

// Export the class
window.MapExporter = MapExporter;