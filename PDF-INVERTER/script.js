const { jsPDF } = window.jspdf;
pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.12.313/pdf.worker.min.js";

// DOM Elements
const elements = {
    pdfInput: document.getElementById('pdfInput'),
    uploadBtn: document.getElementById('uploadBtn'),
    dropZone: document.getElementById('dropZone'),
    fileUploadStatus: document.getElementById('fileUploadStatus'),
    actionButtons: document.getElementById('actionButtons'),
    readBtn: document.getElementById('readBtn'),
    
    downloadInvertedBtn: document.getElementById('downloadInvertedBtn'),
    resetBtn: document.getElementById('resetBtn'),
    pdfContainer: document.getElementById('pdfContainer'),
    pdfCanvas: document.getElementById('pdfCanvas'),
    prevPage: document.getElementById('prevPage'),
    nextPage: document.getElementById('nextPage'),
    pageNum: document.getElementById('pageNum'),
    originalView: document.getElementById('originalView'),
    invertedView: document.getElementById('invertedView'),
    brightness: document.getElementById('brightness'),
    contrast: document.getElementById('contrast'),
    loadingIndicator: document.getElementById('loadingIndicator'),
    themeBtn: document.getElementById('themeBtn')
};

// State
const state = {
    pdfDoc: null,
    currentPage: 1,
    currentView: 'inverted',
    originalCanvas: null,
    modifiedCanvas: null,
    isProcessing: false
};

// Constants
const A4_RATIO = 1.414; // A4 aspect ratio (height/width)
const MAX_CANVAS_WIDTH = 800; // Maximum canvas width for display

// Event Listeners
elements.uploadBtn.addEventListener('click', () => elements.pdfInput.click());
elements.pdfInput.addEventListener('change', handleFileSelect);
elements.dropZone.addEventListener('dragover', handleDragOver);
elements.dropZone.addEventListener('dragleave', handleDragLeave);
elements.dropZone.addEventListener('drop', handleDrop);
elements.readBtn.addEventListener('click', renderPDF);
elements.downloadInvertedBtn.addEventListener('click', () => downloadPDF('inverted'));
elements.resetBtn.addEventListener('click', resetApp);
elements.prevPage.addEventListener('click', () => navigatePage(-1));
elements.nextPage.addEventListener('click', () => navigatePage(1));
elements.originalView.addEventListener('click', () => switchView('original'));
elements.invertedView.addEventListener('click', () => switchView('inverted'));
elements.brightness.addEventListener('input', applyFilters);
elements.contrast.addEventListener('input', applyFilters);
elements.themeBtn.addEventListener('click', toggleTheme);

// Functions
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    processPDFFile(file);
}

function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    elements.dropZone.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    elements.dropZone.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    elements.dropZone.classList.remove('drag-over');
    
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
        processPDFFile(file);
    } else {
        showStatus('Please upload a valid PDF file', 'error');
    }
}

async function processPDFFile(file) {
    if (file.size > 10 * 1024 * 1024) {
        showStatus('File too large (max 10MB)', 'error');
        return;
    }

    showLoading(true);
    showStatus('Uploading PDF...');

    try {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        
        loadingTask.onProgress = (progressData) => {
            const percent = Math.round((progressData.loaded / progressData.total) * 100);
            showStatus(`Loading PDF... ${percent}%`);
        };

        state.pdfDoc = await loadingTask.promise;
        showStatus('PDF uploaded successfully!', 'success');
        elements.actionButtons.classList.remove('hidden');
        state.currentPage = 1;
    } catch (error) {
        console.error('PDF loading error:', error);
        showStatus('Error loading PDF: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function renderPDF() {
    if (!state.pdfDoc) return;
    
    showLoading(true);
    elements.pdfContainer.classList.remove('hidden');
    
    try {
        await renderPage(state.currentPage);
        updatePageControls();
    } catch (error) {
        console.error('Rendering error:', error);
        showStatus('Error rendering PDF', 'error');
    } finally {
        showLoading(false);
    }
}

async function renderPage(pageNum) {
    const page = await state.pdfDoc.getPage(pageNum);
    
    // Calculate dimensions to maintain A4 ratio and fit screen
    const viewport = page.getViewport({ scale: 1.0 });
    const scale = Math.min(MAX_CANVAS_WIDTH / viewport.width, (MAX_CANVAS_WIDTH * A4_RATIO) / viewport.height);
    const scaledViewport = page.getViewport({ scale: scale });
    
    // Set canvas dimensions
    elements.pdfCanvas.width = scaledViewport.width;
    elements.pdfCanvas.height = scaledViewport.height;
    
    // Create a temporary canvas for the original image
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = scaledViewport.width;
    tempCanvas.height = scaledViewport.height;
    
    // Render the page to the temporary canvas
    await page.render({
        canvasContext: tempCanvas.getContext('2d'),
        viewport: scaledViewport
    }).promise;
    
    // Store the original canvas data
    state.originalCanvas = tempCanvas;
    
    // Create a modified version
    state.modifiedCanvas = invertColors(tempCanvas);
    
    // Display based on current view
    displayCurrentView();
}

function invertColors(sourceCanvas) {
    const canvas = document.createElement('canvas');
    canvas.width = sourceCanvas.width;
    canvas.height = sourceCanvas.height;
    const ctx = canvas.getContext('2d');
    
    // Draw the original image
    ctx.drawImage(sourceCanvas, 0, 0);
    
    // Get pixel data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // Invert colors
    for (let i = 0; i < data.length; i += 4) {
        data[i] = 255 - data[i];         // R
        data[i + 1] = 255 - data[i + 1]; // G
        data[i + 2] = 255 - data[i + 2]; // B
        // Alpha channel (data[i+3]) remains unchanged
    }
    
    ctx.putImageData(imageData, 0, 0);
    return canvas;
}

function applyFilters() {
    if (!state.modifiedCanvas) return;
    
    const brightness = parseInt(elements.brightness.value);
    const contrast = parseInt(elements.contrast.value);
    const canvas = document.createElement('canvas');
    canvas.width = state.modifiedCanvas.width;
    canvas.height = state.modifiedCanvas.height;
    const ctx = canvas.getContext('2d');
    
    // Draw the modified image
    ctx.drawImage(state.modifiedCanvas, 0, 0);
    
    // Apply brightness and contrast
    const brightnessValue = brightness / 100;
    const contrastValue = (contrast + 100) / 100;
    
    ctx.filter = `brightness(${1 + brightnessValue}) contrast(${contrastValue})`;
    ctx.drawImage(canvas, 0, 0);
    ctx.filter = 'none';
    
    // Display the filtered image
    const displayCtx = elements.pdfCanvas.getContext('2d');
    displayCtx.clearRect(0, 0, elements.pdfCanvas.width, elements.pdfCanvas.height);
    displayCtx.drawImage(canvas, 0, 0);
}

function displayCurrentView() {
    const ctx = elements.pdfCanvas.getContext('2d');
    ctx.clearRect(0, 0, elements.pdfCanvas.width, elements.pdfCanvas.height);
    
    if (state.currentView === 'original' && state.originalCanvas) {
        ctx.drawImage(state.originalCanvas, 0, 0);
    } else if (state.modifiedCanvas) {
        ctx.drawImage(state.modifiedCanvas, 0, 0);
        applyFilters();
    }
}

function switchView(view) {
    state.currentView = view;
    displayCurrentView();
    
    if (view === 'original') {
        elements.originalView.classList.add('primary');
        elements.originalView.classList.remove('secondary');
        elements.invertedView.classList.add('secondary');
        elements.invertedView.classList.remove('primary');
    } else {
        elements.invertedView.classList.add('primary');
        elements.invertedView.classList.remove('secondary');
        elements.originalView.classList.add('secondary');
        elements.originalView.classList.remove('primary');
    }
}

function navigatePage(offset) {
    const newPage = state.currentPage + offset;
    if (newPage > 0 && newPage <= state.pdfDoc.numPages) {
        state.currentPage = newPage;
        renderPage(state.currentPage);
        updatePageControls();
    }
}

function updatePageControls() {
    elements.pageNum.textContent = `Page: ${state.currentPage}/${state.pdfDoc.numPages}`;
    elements.prevPage.disabled = state.currentPage <= 1;
    elements.nextPage.disabled = state.currentPage >= state.pdfDoc.numPages;
}

async function downloadPDF(type) {
    if (!state.pdfDoc || state.isProcessing) return;
    
    showLoading(true);
    state.isProcessing = true;
    
    try {
        const pdf = new jsPDF({
            orientation: state.pdfDoc.pageWidth > state.pdfDoc.pageHeight ? 'landscape' : 'portrait',
            unit: 'mm'
        });
        
        for (let i = 1; i <= state.pdfDoc.numPages; i++) {
            const page = await state.pdfDoc.getPage(i);
            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            
            await page.render({
                canvasContext: canvas.getContext('2d'),
                viewport: viewport
            }).promise;
            
            // Invert colors if downloading inverted version
            if (type === 'inverted') {
                const ctx = canvas.getContext('2d');
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                
                for (let i = 0; i < data.length; i += 4) {
                    data[i] = 255 - data[i];
                    data[i + 1] = 255 - data[i + 1];
                    data[i + 2] = 255 - data[i + 2];
                }
                
                ctx.putImageData(imageData, 0, 0);
            }
            
            if (i > 1) pdf.addPage();
            
            const imgData = canvas.toDataURL('image/jpeg', 0.8);
            const pdfWidth = pdf.internal.pageSize.getWidth() - 20;
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            
            pdf.addImage(imgData, 'JPEG', 10, 10, pdfWidth, pdfHeight);
        }
        
        // Add copyright page
        pdf.addPage();
        pdf.setFontSize(16);
        pdf.text("PDF processed by PDF Color Inverter", 105, 100, { align: 'center' });
        pdf.text("Copyright © " + new Date().getFullYear(), 105, 120, { align: 'center' });
        
        const fileName = type === 'inverted' ? 'inverted_pdf.pdf' : 'original_pdf.pdf';
        pdf.save(fileName);
        showStatus('PDF downloaded successfully!', 'success');
    } catch (error) {
        console.error('Download error:', error);
        showStatus('Error generating PDF', 'error');
    } finally {
        showLoading(false);
        state.isProcessing = false;
    }
}

function resetApp() {
    state.pdfDoc = null;
    state.currentPage = 1;
    state.originalCanvas = null;
    state.modifiedCanvas = null;
    
    elements.pdfInput.value = '';
    elements.fileUploadStatus.textContent = '';
    elements.actionButtons.classList.add('hidden');
    elements.pdfContainer.classList.add('hidden');
    
    const ctx = elements.pdfCanvas.getContext('2d');
    ctx.clearRect(0, 0, elements.pdfCanvas.width, elements.pdfCanvas.height);
    
    // Reset controls
    elements.brightness.value = 0;
    elements.contrast.value = 0;
    switchView('inverted');
}

function showStatus(message, type = '') {
    elements.fileUploadStatus.textContent = message;
    elements.fileUploadStatus.className = 'status-message';
    if (type) elements.fileUploadStatus.classList.add(type);
}

function showLoading(show) {
    if (show) {
        elements.loadingIndicator.classList.remove('hidden');
    } else {
        elements.loadingIndicator.classList.add('hidden');
    }
}

function toggleTheme() {
    document.body.classList.toggle('light-mode');
    localStorage.setItem('theme', document.body.classList.contains('light-mode') ? 'light' : 'dark');
}

// Initialize
function init() {
    // Check for saved theme preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
    }
    
    // Set initial view
    switchView('inverted');
    
    // Handle window resize for responsive canvas
    window.addEventListener('resize', () => {
        if (state.pdfDoc && state.currentPage) {
            renderPage(state.currentPage);
        }
    });
}

init();