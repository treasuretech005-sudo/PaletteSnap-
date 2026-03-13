/**
 * PaletteSnap - Color Palette Generator
 * Extracts dominant colors from images using Canvas API
 * Frontend-only, no backend required
 */

// DOM Elements
const uploadBox = document.getElementById('uploadBox');
const fileInput = document.getElementById('fileInput');
const uploadContainer = document.getElementById('uploadContainer');
const previewSection = document.getElementById('previewSection');
const previewImage = document.getElementById('previewImage');
const processCanvas = document.getElementById('processCanvas');
const paletteGrid = document.getElementById('paletteGrid');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');
const navToggle = document.getElementById('navToggle');
const navList = document.getElementById('navList');

// State
let currentPalette = [];
let originalImage = null;

// Mobile Navigation Toggle
navToggle.addEventListener('click', () => {
    navList.classList.toggle('active');
});

// Close mobile menu when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.nav')) {
        navList.classList.remove('active');
    }
});

// File Upload Handlers
uploadBox.addEventListener('click', () => fileInput.click());

uploadBox.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadBox.classList.add('drag-over');
});

uploadBox.addEventListener('dragleave', () => {
    uploadBox.classList.remove('drag-over');
});

uploadBox.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadBox.classList.remove('drag-over');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
});

/**
 * Handle uploaded file
 * @param {File} file - The uploaded image file
 */
function handleFile(file) {
    if (!file.type.startsWith('image/')) {
        showToast('Please upload an image file');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        originalImage = new Image();
        originalImage.onload = () => {
            processImage(originalImage);
        };
        originalImage.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

/**
 * Process image and extract colors
 * @param {HTMLImageElement} img - The loaded image
 */
function processImage(img) {
    // Show preview
    previewImage.src = img.src;
    uploadContainer.style.display = 'none';
    previewSection.style.display = 'block';
    
    // Scroll to preview
    previewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Resize image if needed (max 800px width for performance)
    const canvas = processCanvas;
    const ctx = canvas.getContext('2d');
    
    let width = img.width;
    let height = img.height;
    const maxWidth = 800;
    
    if (width > maxWidth) {
        height = (maxWidth / width) * height;
        width = maxWidth;
    }
    
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(img, 0, 0, width, height);
    
    // Extract colors
    const colors = extractDominantColors(canvas, 5);
    currentPalette = colors;
    displayPalette(colors);
}

/**
 * Extract dominant colors using k-means clustering algorithm
 * @param {HTMLCanvasElement} canvas - The canvas containing the image
 * @param {number} colorCount - Number of colors to extract
 * @returns {Array} Array of hex color strings
 */
function extractDominantColors(canvas, colorCount) {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    
    // Sample pixels for performance (every 4th pixel)
    const sampledPixels = [];
    for (let i = 0; i < pixels.length; i += 16) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const a = pixels[i + 3];
        
        // Skip transparent and very dark/white pixels
        if (a < 128) continue;
        if (r > 250 && g > 250 && b > 250) continue;
        if (r < 10 && g < 10 && b < 10) continue;
        
        sampledPixels.push([r, g, b]);
    }
    
    // Use k-means clustering
    const clusters = kMeans(sampledPixels, colorCount, 10);
    
    // Sort by cluster size (dominance)
    clusters.sort((a, b) => b.count - a.count);
    
    return clusters.map(c => rgbToHex(c.center));
}

/**
 * K-means clustering algorithm
 * @param {Array} data - Array of RGB values
 * @param {number} k - Number of clusters
 * @param {number} maxIterations - Maximum iterations
 * @returns {Array} Cluster centers
 */
function kMeans(data, k, maxIterations) {
    // Initialize random centroids
    const centroids = [];
    for (let i = 0; i < k; i++) {
        const randomIndex = Math.floor(Math.random() * data.length);
        centroids.push([...data[randomIndex]]);
    }
    
    let iterations = 0;
    let changed = true;
    
    while (changed && iterations < maxIterations) {
        changed = false;
        iterations++;
        
        // Assign points to clusters
        const clusters = Array(k).fill(null).map(() => ({ points: [], center: centroids.shift() }));
        
        for (const point of data) {
            let minDist = Infinity;
            let clusterIndex = 0;
            
            for (let i = 0; i < k; i++) {
                const dist = colorDistance(point, clusters[i].center);
                if (dist < minDist) {
                    minDist = dist;
                    clusterIndex = i;
                }
            }
            
            clusters[clusterIndex].points.push(point);
        }
        
        // Update centroids
        for (let i = 0; i < k; i++) {
            if (clusters[i].points.length === 0) continue;
            
            const newCenter = clusters[i].points.reduce((acc, point) => {
                acc[0] += point[0];
                acc[1] += point[1];
                acc[2] += point[2];
                return acc;
            }, [0, 0, 0]);
            
            newCenter[0] = Math.round(newCenter[0] / clusters[i].points.length);
            newCenter[1] = Math.round(newCenter[1] / clusters[i].points.length);
            newCenter[2] = Math.round(newCenter[2] / clusters[i].points.length);
            
            if (colorDistance(newCenter, clusters[i].center) > 1) {
                changed = true;
            }
            
            clusters[i].center = newCenter;
            clusters[i].count = clusters[i].points.length;
        }
        
        centroids.push(...clusters.map(c => c.center));
    }
    
    return clusters.map(c => ({ center: c.center, count: c.count }));
}

/**
 * Calculate color distance (Euclidean)
 * @param {Array} c1 - RGB array 1
 * @param {Array} c2 - RGB array 2
 * @returns {number} Distance
 */
function colorDistance(c1, c2) {
    return Math.sqrt(
        Math.pow(c1[0] - c2[0], 2) +
        Math.pow(c1[1] - c2[1], 2) +
        Math.pow(c1[2] - c2[2], 2)
    );
}

/**
 * Convert RGB to Hex
 * @param {Array} rgb - RGB array
 * @returns {string} Hex color
 */
function rgbToHex(rgb) {
    return '#' + rgb.map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

/**
 * Display color palette in UI
 * @param {Array} colors - Array of hex colors
 */
function displayPalette(colors) {
    paletteGrid.innerHTML = '';
    
    colors.forEach((color, index) => {
        const block = document.createElement('div');
        block.className = 'color-block';
        block.innerHTML = `
            <div class="color-preview" style="background-color: ${color}"></div>
            <div class="color-info">
                <div class="color-hex">${color}</div>
            </div>
        `;
        
        block.addEventListener('click', () => {
            copyToClipboard(color);
            block.classList.add('copied');
            setTimeout(() => block.classList.remove('copied'), 2000);
        });
        
        paletteGrid.appendChild(block);
    });
}

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 */
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showToast(`Copied ${text} to clipboard`);
    } catch (err) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showToast(`Copied ${text} to clipboard`);
    }
}

/**
 * Show toast notification
 * @param {string} message - Message to display
 */
function showToast(message) {
    toastMessage.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Button Event Listeners
document.getElementById('copyAllBtn').addEventListener('click', () => {
    const allColors = currentPalette.join(', ');
    copyToClipboard(allColors);
});

document.getElementById('downloadBtn').addEventListener('click', downloadPalette);

document.getElementById('shareBtn').addEventListener('click', sharePalette);

/**
 * Download palette as PNG image
 */
function downloadPalette() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const width = 1200;
    const height = 800;
    const colorHeight = 500;
    const padding = 60;
    
    canvas.width = width;
    canvas.height = height;
    
    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    
    // Title
    ctx.fillStyle = '#1a1a1a';
    ctx.font = 'bold 48px Poppins, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PaletteSnap Color Palette', width / 2, 100);
    
    // Subtitle
    ctx.font = '24px Poppins, sans-serif';
    ctx.fillStyle = '#6b6b6b';
    ctx.fillText('Generated from your image', width / 2, 140);
    
    // Color blocks
    const blockWidth = (width - (padding * 2) - ((currentPalette.length - 1) * 20)) / currentPalette.length;
    
    currentPalette.forEach((color, index) => {
        const x = padding + (index * (blockWidth + 20));
        const y = 200;
        
        // Color block
        ctx.fillStyle = color;
        ctx.fillRect(x, y, blockWidth, colorHeight);
        
        // Border
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, blockWidth, colorHeight);
        
        // Hex label background
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.fillRect(x + 10, y + colorHeight - 70, blockWidth - 20, 50);
        
        // Hex text
        ctx.fillStyle = '#1a1a1a';
        ctx.font = 'bold 24px Courier New, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(color.toUpperCase(), x + blockWidth / 2, y + colorHeight - 35);
    });
    
    // Footer
    ctx.fillStyle = '#4CAF50';
    ctx.font = '20px Poppins, sans-serif';
    ctx.fillText('Created with PaletteSnap', width / 2, height - 60);
    
    // Download
    const link = document.createElement('a');
    link.download = `palettesnap-palette-${Date.now()}.png`;
    link.href = canvas.toDataURL();
    link.click();
    
    showToast('Palette downloaded successfully');
}

/**
 * Share palette using Web Share API or fallback to clipboard
 */
async function sharePalette() {
    const shareData = {
        title: 'My PaletteSnap Color Palette',
        text: `Check out this color palette: ${currentPalette.join(', ')}`,
        url: window.location.href
    };
    
    if (navigator.share) {
        try {
            await navigator.share(shareData);
        } catch (err) {
            if (err.name !== 'AbortError') {
                copyToClipboard(shareData.text);
            }
        }
    } else {
        copyToClipboard(shareData.text);
    }
}

// Smooth scroll for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            navList.classList.remove('active');
        }
    });
});
