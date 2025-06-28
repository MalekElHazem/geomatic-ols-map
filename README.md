# 3D OLS Viewer - GitHub Pages Ready

This is a clean, deployment-ready version of the 3D Obstacle Limitation Surfaces (OLS) viewer built with Cesium.js.

## Files Structure

```
github-pages-ready/
├── index.html              # Main viewer application
├── data/                   # Required data files
│   ├── obstacles.json      # Obstacle data
│   ├── horizontal.geojson  # Horizontal surface
│   ├── conical.geojson     # Conical surface
│   ├── conical_3d.geojson  # 3D Conical surface
│   ├── takeoff.geojson     # Takeoff surface
│   └── surfaceapproche.geojson # Approach surface
└── README.md               # This file
```

## Features

- 3D visualization of airport obstacle limitation surfaces
- Interactive terrain with DEM data
- Multiple surface types (horizontal, conical, takeoff, approach)
- Obstacle markers with height information
- Camera controls and navigation
- Layer toggles for different surfaces

## Deployment Options

### GitHub Pages (Recommended)

1. Create a new repository on GitHub
2. Upload all files from this directory to the repository
3. Go to Settings → Pages
4. Select "Deploy from a branch" and choose "main" branch
5. Your site will be available at `https://yourusername.github.io/repository-name`

### Netlify

1. Create account at netlify.com
2. Drag and drop this entire folder to Netlify deploy area
3. Your site will be live instantly with a random URL
4. (Optional) Configure custom domain

### Vercel

1. Create account at vercel.com
2. Import from GitHub or upload folder
3. Deploy automatically

### Firebase Hosting

1. Install Firebase CLI: `npm install -g firebase-tools`
2. Run `firebase init hosting` in this directory
3. Deploy with `firebase deploy`

## Important Notes

### Cesium Ion Token

The application uses Cesium's default public token. For production use:

1. Create account at cesium.com/ion
2. Generate your own access token
3. Replace the token in `index.html`:
   ```javascript
   Cesium.Ion.defaultAccessToken = 'YOUR_TOKEN_HERE';
   ```

### CORS Considerations

- All data files are loaded from relative paths
- No external API calls except Cesium services
- Should work on any static hosting platform

### Browser Requirements

- Modern browsers with WebGL support
- Chrome, Firefox, Safari, Edge (recent versions)

## Local Testing

To test locally before deployment:

1. Start a local web server in this directory:
   - Python: `python -m http.server 8000`
   - Node.js: `npx serve .`
   - PHP: `php -S localhost:8000`

2. Open `http://localhost:8000` in your browser

## Data Sources

- DEM data: USGS SRTM
- Obstacle data: Custom JSON format
- Surface data: GeoJSON format generated from OLS calculations

## License

This project is part of an educational/research initiative for airport safety visualization.
