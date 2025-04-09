document.addEventListener('DOMContentLoaded', () => {
    const dropArea = document.getElementById('drop-area');
    const fileInput = document.getElementById('file-input');
    const uploadButton = document.getElementById('upload-button');
    const resultsContainer = document.getElementById('results-container');
    const resultTemplate = document.getElementById('result-template');

    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    // Highlight drop area when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, unhighlight, false);
    });

    // Handle dropped files
    dropArea.addEventListener('drop', handleDrop, false);
    
    // Handle file input change
    fileInput.addEventListener('change', handleFiles, false);
    
    // Handle upload button click
    uploadButton.addEventListener('click', () => {
        fileInput.click();
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    function highlight() {
        dropArea.classList.add('highlight');
    }

    function unhighlight() {
        dropArea.classList.remove('highlight');
    }

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles({ target: { files } });
    }

    function handleFiles(e) {
        const files = [...e.target.files];
        files.forEach(processFile);
    }

    function processFile(file) {
        if (!file.type.match('image.*')) {
            alert('Only image files are supported!');
            return;
        }

        const reader = new FileReader();
        
        reader.onloadstart = () => {
            // Create and add a result item to the container
            const resultElement = createResultElement(file);
            resultsContainer.prepend(resultElement);
        };
        
        reader.onprogress = (event) => {
            if (event.lengthComputable) {
                const percentLoaded = Math.round((event.loaded / event.total) * 100);
                // Update progress if needed
            }
        };
        
        reader.onload = (event) => {
            const base64String = event.target.result;
            
            // Create an image element to get dimensions
            const img = new Image();
            img.onload = () => {
                const resultElement = document.querySelector(`.result-item[data-filename="${file.name}"]`);
                
                if (resultElement) {
                    // Update file information
                    resultElement.querySelector('.encoded-size').textContent = formatBytes(base64String.length);
                    resultElement.querySelector('.width').textContent = `${img.width}px`;
                    resultElement.querySelector('.height').textContent = `${img.height}px`;
                    
                    // Fill the img tag code
                    const imgCode = resultElement.querySelector('.img-code');
                    imgCode.value = `<img src="${base64String}" alt="${file.name}" />`;
                    
                    // Fill the CSS background code
                    const cssCode = resultElement.querySelector('.css-code');
                    cssCode.value = `background-image: url(${base64String});`;
                }
            };
            img.src = base64String;
        };
        
        reader.onerror = () => {
            alert('There was an error reading the file!');
        };
        
        reader.readAsDataURL(file);
    }

    function createResultElement(file) {
        const resultElement = document.importNode(resultTemplate.content, true).firstElementChild;
        
        // Set a unique identifier
        resultElement.setAttribute('data-filename', file.name);
        
        // Fill in the available information
        resultElement.querySelector('.filename').textContent = file.name;
        resultElement.querySelector('.filesize').textContent = formatBytes(file.size);
        
        // Set up copy buttons
        const copyButtons = resultElement.querySelectorAll('.copy-button');
        copyButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetType = button.getAttribute('data-target');
                const textArea = resultElement.querySelector(targetType === 'img' ? '.img-code' : '.css-code');
                
                copyToClipboard(textArea.value);
                
                // Provide feedback
                const originalText = button.textContent;
                button.textContent = 'Copied!';
                setTimeout(() => {
                    button.textContent = originalText;
                }, 2000);
            });
        });
        
        return resultElement;
    }

    function copyToClipboard(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
    }

    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
}); 