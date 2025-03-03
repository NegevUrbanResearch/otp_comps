# Hospital Accessibility Map Exporter

A modular solution for exporting maps from the Beer Sheva Hospital Accessibility Analysis tool. This README contains comprehensive instructions for setting up the analysis tool and using the export functionality.

## System Requirements

- Node.js (v14 or higher)
- Python (for local web server)
- OpenTripPlanner (OTP) server (for routing analysis)

## Setup Instructions (Three Terminal Windows)

This locally hosted application requires running **three separate processes simultaneously**, each in its own terminal window:

1. **OpenTripPlanner (OTP) Server** - For routing calculations
2. **Export Server** - For image and HTML generation
3. **Local Web Server** - To serve your HTML application

## Quick Start Guide

### Terminal 1: Start the OTP Server

```bash
# Navigate to the OTP directory
cd /Users/noamgal/Downloads/NUR/otp_project

# Run the OTP server
java -Xmx8G -jar otp-2.5.0-shaded.jar --load --serve graphs
```

### Terminal 2: Start the Export Server

```bash
# Navigate to the export server directory
cd map-export-server

# Install dependencies (first time only)
npm install

# Start the server
npm start
```

### Terminal 3: Start the Local Web Server

```bash
# Navigate to the directory containing your HTML file
cd hospital-analysis

# Start a Python web server
python -m http.server 8000
```

### Access Your Application

Open your browser and go to:
```
http://localhost:8000/hosp_access.html
```

## Export Functionality

The system now supports two export formats:

1. **Image Export (PNG)** - For static image exports including all analysis points
2. **Interactive HTML Export** - For interactive visualization with all functionality

### Using the Export Feature

1. Run the analysis by clicking "Run Analysis"
2. Once complete, go to the "Export" tab
3. Choose your preferred export format:
   - "Export as PNG" for a static image
   - "Export as Interactive HTML" for a fully interactive version
4. Customize the title and subtitle if needed
5. Click the export button and wait for the download

## Troubleshooting

### Common Issues

- **Missing analysis points in export**: Make sure to complete the analysis before exporting
- **Browser freezes during export**: Large analyses may take time to process
- **"CORS error" in console**: Make sure all three servers are running

### Verifying Server Status

- OTP Server: http://localhost:8080
- Export Server: http://localhost:3000
- Local Web Server: http://localhost:8000

If any of these URLs don't load, that server isn't running correctly.