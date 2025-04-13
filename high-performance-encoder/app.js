/**
 * High Performance Base64 Image Encoder
 * Optimized for handling large batches of images using Web Workers
 */

document.addEventListener("DOMContentLoaded", () => {
  // DOM elements
  const dropArea = document.getElementById("drop-area");
  const fileInput = document.getElementById("file-input");
  const uploadButton = document.getElementById("upload-button");
  const startProcessingButton = document.getElementById("start-processing");
  const resizeCheckbox = document.getElementById("resize-checkbox");
  const resizeControls = document.getElementById("resize-controls");
  const resizeWidth = document.getElementById("resize-width");
  const resizeHeight = document.getElementById("resize-height");
  const maintainAspectRatio = document.getElementById("maintain-aspect");
  const batchProcessingCheckbox = document.getElementById("batch-processing");
  const batchSizeInput = document.getElementById("batch-size");
  const progressContainer = document.getElementById("progress-container");
  const progressBar = document.getElementById("progress-bar");
  const progressPercentage = document.getElementById("progress-percentage");
  const processedCount = document.getElementById("processed-count");
  const totalCount = document.getElementById("total-count");
  const bulkActions = document.getElementById("bulk-actions");
  const copyAllButton = document.getElementById("copy-all-button");
  const saveAllButton = document.getElementById("save-all-button");
  const resetButton = document.getElementById("reset-button");
  const resultsContainer = document.getElementById("results-container");
  const resultsGrid = document.getElementById("results-grid");
  const resultsSummary = document.getElementById("results-summary");
  const resultTemplate = document.getElementById("result-template");

  // State
  let files = [];
  let processedFiles = [];
  let processingActive = false;
  let totalProcessed = 0;
  let totalErrors = 0;
  let supportsWebWorker = true;

  // Check for Web Worker support
  try {
    const maxConcurrent = 4; // Maximum number of concurrent workers
    let activeWorkers = 0;
    let workerPool = [];

    // Initialize worker pool
    for (let i = 0; i < maxConcurrent; i++) {
      try {
        const worker = new Worker("workers/image-worker.js");
        worker.onmessage = handleWorkerMessage;
        worker.onerror = handleWorkerError;
        worker.busy = false;
        workerPool.push(worker);
      } catch (error) {
        console.error("Failed to create Web Worker:", error);
        supportsWebWorker = false;
        break;
      }
    }

    if (workerPool.length === 0) {
      supportsWebWorker = false;
    }
  } catch (error) {
    console.error("Web Workers not supported:", error);
    supportsWebWorker = false;
  }

  // Show warning if web workers aren't supported
  if (!supportsWebWorker) {
    const workerWarning = document.createElement("div");
    workerWarning.className = "warning-message";
    workerWarning.innerHTML =
      "Your browser may not fully support Web Workers. The application will still work, but performance may be reduced for large batches.";
    document.querySelector("header").appendChild(workerWarning);

    // Adjust UI
    batchProcessingCheckbox.checked = false;
    batchProcessingCheckbox.disabled = true;
    batchProcessingCheckbox.parentNode.classList.add("disabled");
  }

  // Event Listeners
  resizeCheckbox.addEventListener("change", toggleResizeControls);
  fileInput.addEventListener("change", handleFileSelect);
  uploadButton.addEventListener("click", () => fileInput.click());
  startProcessingButton.addEventListener("click", startProcessing);
  copyAllButton.addEventListener("click", copyAllBase64);
  saveAllButton.addEventListener("click", saveAsTextFile);
  resetButton.addEventListener("click", resetApplication);

  // Drag and drop handling
  ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
    dropArea.addEventListener(eventName, preventDefaults, false);
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    dropArea.addEventListener(eventName, highlight, false);
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropArea.addEventListener(eventName, unhighlight, false);
  });

  dropArea.addEventListener("drop", handleDrop, false);

  // Functions
  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  function highlight() {
    dropArea.classList.add("dragover");
  }

  function unhighlight() {
    dropArea.classList.remove("dragover");
  }

  function toggleResizeControls() {
    if (resizeCheckbox.checked) {
      resizeControls.classList.remove("hidden");
    } else {
      resizeControls.classList.add("hidden");
    }
  }

  function handleDrop(e) {
    const dt = e.dataTransfer;
    const newFiles = Array.from(dt.files).filter((file) =>
      file.type.match("image.*")
    );

    if (newFiles.length === 0) {
      alert("Please drop only image files.");
      return;
    }

    addFiles(newFiles);
  }

  function handleFileSelect(e) {
    const newFiles = Array.from(e.target.files).filter((file) =>
      file.type.match("image.*")
    );

    if (newFiles.length === 0) {
      alert("Please select only image files.");
      return;
    }

    addFiles(newFiles);
  }

  function addFiles(newFiles) {
    files = [...files, ...newFiles];
    startProcessingButton.disabled = files.length === 0;

    // Update UI to show file count
    const fileCountMsg = `${files.length} image${
      files.length !== 1 ? "s" : ""
    } selected`;
    dropArea.querySelector("p").textContent = fileCountMsg;
    dropArea.classList.add("has-files");

    // Clear the file input
    fileInput.value = "";
  }

  function startProcessing() {
    if (files.length === 0) {
      alert("Please select image files first.");
      return;
    }

    // Reset state
    processedFiles = [];
    totalProcessed = 0;
    totalErrors = 0;
    processingActive = true;

    // Update UI
    startProcessingButton.disabled = true;
    progressContainer.classList.remove("hidden");
    updateProgress(0, files.length);

    // Empty results grid
    resultsGrid.innerHTML = "";

    // Process files - use appropriate method based on browser support
    if (supportsWebWorker && batchProcessingCheckbox.checked) {
      processBatchFiles();
    } else {
      processFilesSequentially();
    }
  }

  function processBatchFiles() {
    const batchSize = parseInt(batchSizeInput.value) || 10;
    let fileQueue = [...files];
    let currentBatch = [];

    function processNextBatch() {
      if (fileQueue.length === 0 || !processingActive) {
        return;
      }

      // Get next batch
      currentBatch = fileQueue.splice(0, batchSize);

      // Process each file in the batch using available workers
      currentBatch.forEach((file, index) => {
        queueFileProcessing(file);
      });
    }

    processNextBatch();
  }

  function processFilesSequentially() {
    const fileQueue = [...files];
    let currentIndex = 0;

    function processNext() {
      if (currentIndex >= fileQueue.length || !processingActive) {
        return;
      }

      const file = fileQueue[currentIndex++];

      if (supportsWebWorker) {
        queueFileProcessing(file, () => {
          setTimeout(processNext, 10); // Small delay to prevent UI freezing
        });
      } else {
        // Process in main thread if web workers not supported
        processFileMainThread(file, () => {
          setTimeout(processNext, 10); // Small delay to prevent UI freezing
        });
      }
    }

    // Start processing with a limited number of concurrent files
    const concurrentFiles = supportsWebWorker ? 4 : 1;
    for (let i = 0; i < Math.min(concurrentFiles, files.length); i++) {
      processNext();
    }
  }

  function queueFileProcessing(file, callback) {
    if (!supportsWebWorker) {
      processFileMainThread(file, callback);
      return;
    }

    // Find an available worker
    const availableWorker = workerPool.find((worker) => !worker.busy);

    if (!availableWorker) {
      // If no workers available, try again later
      setTimeout(() => queueFileProcessing(file, callback), 100);
      return;
    }

    availableWorker.busy = true;
    activeWorkers++;

    // Read file as array buffer for worker
    const reader = new FileReader();
    reader.onload = function (e) {
      availableWorker.postMessage(
        {
          type: "process",
          data: {
            imageData: e.target.result,
            id: generateId(),
            fileName: file.name,
            options: {
              resize: resizeCheckbox.checked,
              width: parseInt(resizeWidth.value) || 600,
              height: parseInt(resizeHeight.value) || 400,
              maintainAspect: maintainAspectRatio.checked,
            },
          },
        },
        [e.target.result]
      ); // Transfer ownership to avoid copying
    };

    reader.onerror = function () {
      handleProcessingError(file.name, "Error reading file");
      releaseWorker(availableWorker);
      if (callback) callback();
    };

    reader.readAsArrayBuffer(file);
  }

  // Process file in the main thread when web workers aren't available
  function processFileMainThread(file, callback) {
    const reader = new FileReader();

    reader.onload = function (e) {
      const id = generateId();
      const img = new Image();

      img.onload = function () {
        let finalWidth = img.width;
        let finalHeight = img.height;
        let finalBase64 = e.target.result;

        // Handle resize if needed
        if (resizeCheckbox.checked) {
          const targetWidth = parseInt(resizeWidth.value) || 600;
          const targetHeight = parseInt(resizeHeight.value) || 400;
          const maintainAspect = maintainAspectRatio.checked;

          // Calculate dimensions
          const dimensions = calculateDimensions(
            img.width,
            img.height,
            targetWidth,
            targetHeight,
            maintainAspect
          );

          // Create canvas and resize
          const canvas = document.createElement("canvas");
          canvas.width = dimensions.width;
          canvas.height = dimensions.height;

          // Draw resized image
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, dimensions.width, dimensions.height);

          // Get resized base64
          finalBase64 = canvas.toDataURL(getMimeType(file.name));
          finalWidth = dimensions.width;
          finalHeight = dimensions.height;
        }

        // Process the result
        processedFiles.push({
          id,
          fileName: file.name,
          base64: finalBase64,
          width: finalWidth,
          height: finalHeight,
          originalSize: file.size,
          encodedSize: finalBase64.length,
        });

        totalProcessed++;
        updateProgress(totalProcessed + totalErrors, files.length);
        addResultToGrid(
          id,
          file.name,
          finalBase64,
          finalWidth,
          finalHeight,
          file.size
        );

        // Check if processing is complete
        checkProcessingComplete();

        // Call the callback
        if (callback) callback();
      };

      img.onerror = function () {
        handleProcessingError(file.name, "Error loading image");
        if (callback) callback();
      };

      img.src = e.target.result;
    };

    reader.onerror = function () {
      handleProcessingError(file.name, "Error reading file");
      if (callback) callback();
    };

    reader.readAsDataURL(file);
  }

  function handleWorkerMessage(e) {
    const { type, id, fileName, base64, error, width, height, originalSize } =
      e.data;

    // Find and release the worker
    const worker = workerPool.find((w) => w === e.target);
    if (worker) worker.busy = false;
    activeWorkers--;

    if (type === "result") {
      // Handle successful processing
      processedFiles.push({
        id,
        fileName,
        base64,
        width,
        height,
        originalSize,
        encodedSize: base64.length,
      });

      totalProcessed++;
      updateProgress(totalProcessed + totalErrors, files.length);
      addResultToGrid(id, fileName, base64, width, height, originalSize);

      // Check if processing is complete
      checkProcessingComplete();
    } else if (type === "error") {
      // Handle error
      handleProcessingError(fileName, error);
    }

    // Process next batch if all workers are free
    if (
      batchProcessingCheckbox.checked &&
      activeWorkers === 0 &&
      processingActive
    ) {
      processBatchFiles();
    }
  }

  function handleWorkerError(e) {
    console.error("Worker error:", e);
    totalErrors++;
    updateProgress(totalProcessed + totalErrors, files.length);

    // Release the worker
    const worker = workerPool.find((w) => w === e.target);
    if (worker) worker.busy = false;
    activeWorkers--;

    // Check if processing is complete
    checkProcessingComplete();
  }

  function releaseWorker(worker) {
    if (worker) {
      worker.busy = false;
      activeWorkers--;
    }
  }

  function generateId() {
    return `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  function updateProgress(current, total) {
    const percent = total > 0 ? Math.round((current / total) * 100) : 0;

    progressBar.style.width = `${percent}%`;
    progressPercentage.textContent = `${percent}%`;
    processedCount.textContent = current;
    totalCount.textContent = total;

    // Show summary
    resultsSummary.textContent = `${totalProcessed} processed, ${totalErrors} failed`;
  }

  function handleProcessingError(fileName, errorMsg) {
    console.error(`Error processing ${fileName}: ${errorMsg}`);
    totalErrors++;
    updateProgress(totalProcessed + totalErrors, files.length);

    // Check if processing is complete
    checkProcessingComplete();
  }

  function addResultToGrid(id, fileName, base64, width, height, originalSize) {
    // Create result element from template
    const resultElement = document.importNode(
      resultTemplate.content,
      true
    ).firstElementChild;

    // Set data
    resultElement.setAttribute("data-id", id);
    resultElement.querySelector(".result-filename").textContent = fileName;
    resultElement.querySelector(".result-thumbnail").src = base64;
    resultElement.querySelector(
      ".result-dimensions"
    ).textContent = `${width}×${height}`;

    const originalKB = Math.round(originalSize / 1024);
    const encodedKB = Math.round(base64.length / 1024);
    resultElement.querySelector(
      ".result-size"
    ).textContent = `${originalKB}KB → ${encodedKB}KB`;

    // Set up copy button
    const copyButton = resultElement.querySelector(".copy-button");
    copyButton.addEventListener("click", () => {
      copyToClipboard(base64);
      copyButton.textContent = "Copied!";
      setTimeout(() => {
        copyButton.textContent = "Copy";
      }, 2000);
    });

    // Add to results grid
    resultsGrid.appendChild(resultElement);

    // Show results container if hidden
    resultsContainer.classList.remove("hidden");
  }

  function checkProcessingComplete() {
    if (totalProcessed + totalErrors >= files.length) {
      processingActive = false;
      bulkActions.classList.remove("hidden");
      startProcessingButton.disabled = false;

      console.log(
        `Processing complete: ${totalProcessed} successful, ${totalErrors} failed`
      );
    }
  }

  function copyAllBase64() {
    if (processedFiles.length === 0) {
      alert("No files have been processed yet.");
      return;
    }

    let copyText = "";

    // Generate numbered sequence starting from 0
    processedFiles.forEach((file, index) => {
      copyText += `/* ${index}. ${file.fileName} */\n<img src="${file.base64}" alt="${file.fileName}" />\n\n`;
    });

    copyToClipboard(copyText);

    // Provide feedback
    copyAllButton.textContent = "Copied!";
    setTimeout(() => {
      copyAllButton.textContent = "Copy All Images";
    }, 2000);
  }

  function saveAsTextFile() {
    if (processedFiles.length === 0) {
      alert("No files have been processed yet.");
      return;
    }

    let fileContent = "";

    // Generate numbered sequence starting from 0
    processedFiles.forEach((file, index) => {
      fileContent += `/* ${index}. ${file.fileName} */\n<img src="${file.base64}" alt="${file.fileName}" />\n\n`;
    });

    // Create file and trigger download
    const blob = new Blob([fileContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `base64_images_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();

    // Clean up
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  function resetApplication() {
    // Reset state
    files = [];
    processedFiles = [];
    processingActive = false;

    // Update UI
    progressContainer.classList.add("hidden");
    bulkActions.classList.add("hidden");
    resultsContainer.classList.add("hidden");

    startProcessingButton.disabled = true;
    dropArea.querySelector("p").textContent = "Drag & drop images here or";
    dropArea.classList.remove("has-files");

    // Clear results
    resultsGrid.innerHTML = "";
    resultsSummary.textContent = "";
  }

  function copyToClipboard(text) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  }

  // Helper functions for main thread processing
  function calculateDimensions(
    srcWidth,
    srcHeight,
    targetWidth,
    targetHeight,
    maintainAspect
  ) {
    if (!maintainAspect) {
      return { width: targetWidth, height: targetHeight };
    }

    const srcRatio = srcWidth / srcHeight;
    const targetRatio = targetWidth / targetHeight;

    let newWidth = targetWidth;
    let newHeight = targetHeight;

    if (srcRatio > targetRatio) {
      // Source image is wider
      newHeight = targetWidth / srcRatio;
    } else {
      // Source image is taller
      newWidth = targetHeight * srcRatio;
    }

    return {
      width: Math.round(newWidth),
      height: Math.round(newHeight),
    };
  }

  function getMimeType(fileName) {
    const extension = fileName.split(".").pop().toLowerCase();

    const mimeTypes = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      svg: "image/svg+xml",
      bmp: "image/bmp",
    };

    return mimeTypes[extension] || "image/png";
  }
});
