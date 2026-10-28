import { useEffect, useRef, useState } from "react";
import "./App.css";

const API_URL = "http://127.0.0.1:8000";

const DEFECTS = [
  { name: "crazing", label: "Crazing", number: "01" },
  { name: "inclusion", label: "Inclusion", number: "02" },
  { name: "patches", label: "Patches", number: "03" },
  { name: "pitted_surface", label: "Pitted surface", number: "04" },
  { name: "rolled-in_scale", label: "Rolled-in scale", number: "05" },
  { name: "scratches", label: "Scratches", number: "06" },
];

function App() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [apiOnline, setApiOnline] = useState(false);
  const [error, setError] = useState("");

  const inputRef = useRef(null);

  // Check whether the FastAPI backend is running.
  useEffect(() => {
    let active = true;

    async function checkAPI() {
      try {
        const response = await fetch(`${API_URL}/health`);

        if (active) {
          setApiOnline(response.ok);
        }
      } catch {
        if (active) {
          setApiOnline(false);
        }
      }
    }

    checkAPI();

    const timer = setInterval(checkAPI, 10000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  // Generate a preview of the selected image.
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }

    const url = URL.createObjectURL(file);
    setPreview(url);

    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Validate and select an image.
  function selectFile(selectedFile) {
    if (!selectedFile) return;

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(selectedFile.type)) {
      setError("Please select a PNG, JPG, JPEG, or WEBP image.");
      return;
    }

    setFile(selectedFile);
    setResults(null);
    setError("");
  }

  // Send the image to the YOLO11 backend.
  async function analyzeImage() {
    if (!file) {
      setError("Choose a steel surface image first.");
      return;
    }

    setLoading(true);
    setError("");
    setResults(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${API_URL}/predict`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.detail || "The inspection request failed."
        );
      }

      setResults(data);
    } catch (err) {
      setError(
        err.message ||
          "Could not connect to the inspection API. Check that FastAPI is running."
      );
    } finally {
      setLoading(false);
    }
  }

  // Safely read the predictions returned by FastAPI.
  const detections = Array.isArray(results?.detections)
    ? results.detections
    : [];

  const totalDetections =
    results?.total_detections ?? detections.length;

  // Count detections belonging to each defect class.
  const defectCounts = DEFECTS.map((defect) => ({
    ...defect,
    count: detections.filter((item) => {
      const detectedName = String(
        item.class_name ?? item.name ?? item.class ?? ""
      )
        .toLowerCase()
        .replaceAll(" ", "_");

      return detectedName === defect.name;
    }).length,
  }));

  // Calculate mean confidence across all detections.
  const averageConfidence = detections.length
    ? (
        (detections.reduce(
          (sum, item) => sum + Number(item.confidence ?? 0),
          0
        ) /
          detections.length) *
        100
      ).toFixed(1)
    : "0.0";

  // Draw a bounding box for each valid prediction.
  function renderBoundingBox(item, index) {
    const box = item.bounding_box;

    if (
      !Array.isArray(box) ||
      box.length !== 4 ||
      !box.every(
        (value) =>
          typeof value === "number" && Number.isFinite(value)
      )
    ) {
      return null;
    }

    const [x1, y1, x2, y2] = box;

    const imageWidth = Number(results?.image_width);
    const imageHeight = Number(results?.image_height);

    if (
      !Number.isFinite(imageWidth) ||
      !Number.isFinite(imageHeight) ||
      imageWidth <= 0 ||
      imageHeight <= 0 ||
      x2 <= x1 ||
      y2 <= y1
    ) {
      return null;
    }

    // Convert image-pixel coordinates to percentages.
    const left = (x1 / imageWidth) * 100;
    const top = (y1 / imageHeight) * 100;
    const width = ((x2 - x1) / imageWidth) * 100;
    const height = ((y2 - y1) / imageHeight) * 100;

    const label = String(
      item.class_name ?? item.name ?? item.class ?? "Unknown"
    ).replaceAll("_", " ");

    const confidence = (
      Number(item.confidence ?? 0) * 100
    ).toFixed(1);

    return (
      <div
        key={`${label}-${index}`}
        className="defect-box"
        style={{
          left: `${left}%`,
          top: `${top}%`,
          width: `${width}%`,
          height: `${height}%`,
        }}
        title={`${label}: ${confidence}%`}
      >
        <span className="defect-box-label">
          {label} {confidence}%
        </span>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {/* Header */}
      <header className="topbar">
        <a className="brand" href="#home">
          <span className="brand-mark">S</span>
          <span>
            <strong>SteelSight</strong>
            <small>INTELLIGENCE PLATFORM</small>
          </span>
        </a>

        <nav className="top-nav">
          <a className="nav-active" href="#inspection">
            Inspection
          </a>
          <a href="#analytics">Defect analytics</a>
        </nav>

        <div className="system-status">
          <span
            className={`status-dot ${
              apiOnline ? "online" : "offline"
            }`}
          />
          <span>
            {apiOnline ? "API connected" : "API offline"}
          </span>
        </div>
      </header>

      <main id="home" className="main-content">
        {/* Hero section */}
        <section className="welcome-section">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-line" />
              INDUSTRIAL COMPUTER VISION
            </div>

            <h1>
              Surface inspection,
              <br />
              <span>powered by AI.</span>
            </h1>

            <p className="welcome-copy">
              Detect and review steel surface defects with
              your trained YOLO11 model. Upload an image
              to begin an inspection.
            </p>

            <div className="technology-list">
              <span>YOLO11</span>
              <span>Computer Vision</span>
              <span>FastAPI</span>
              <span>React</span>
            </div>
          </div>

          <div className="hero-visual" aria-hidden="true">
            <div className="visual-grid" />
            <div className="visual-ring ring-one" />
            <div className="visual-ring ring-two" />

            <div className="visual-center">
              <span className="visual-cross">+</span>
              <strong>AI</strong>
              <small>VISION</small>
            </div>

            <span className="visual-label label-top">
              SURFACE ANALYSIS
            </span>

            <span className="visual-label label-bottom">
              YOLO11 / DETECTION
            </span>

            <span className="visual-corner corner-one" />
            <span className="visual-corner corner-two" />
          </div>
        </section>

        {/* Inspection section */}
        <section id="inspection" className="section-block">
          <div className="section-heading">
            <div>
              <span className="section-index">
                01 / INSPECTION
              </span>
              <h2>Image inspection</h2>
              <p>
                Upload a sample and run your trained detection model.
              </p>
            </div>

            <span className="section-badge">
              {loading ? "PROCESSING" : "IMAGE ANALYSIS"}
            </span>
          </div>

          <div className="inspection-grid">
            {/* Upload panel */}
            <article className="panel upload-panel">
              <div className="panel-heading">
                <div>
                  <span className="micro-label">INPUT</span>
                  <h3>Steel surface image</h3>
                </div>

                <span className="step-number">01</span>
              </div>

              <div
                className={`drop-zone ${
                  file ? "has-image" : ""
                }`}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  selectFile(event.dataTransfer.files?.[0]);
                }}
              >
                {preview ? (
                  <img
                    className="image-preview"
                    src={preview}
                    alt="Selected steel surface"
                  />
                ) : (
                  <div className="upload-placeholder">
                    <div className="upload-icon">↑</div>
                    <strong>Drop your image here</strong>
                    <span>
                      Or browse your computer to select a file
                    </span>
                    <span className="file-formats">
                      PNG · JPG · JPEG · WEBP
                    </span>
                  </div>
                )}

                <input
                  ref={inputRef}
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                  onChange={(event) => {
                    selectFile(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                  hidden
                />
              </div>

              <button
                type="button"
                className="secondary-button browse-button"
                onClick={() => inputRef.current?.click()}
              >
                {file ? "Choose another image" : "Browse images"}
              </button>

              {file && (
                <div className="selected-file">
                  <span className="file-icon">IMG</span>

                  <div className="file-details">
                    <strong>{file.name}</strong>
                    <small>
                      {(file.size / 1024).toFixed(1)} KB
                    </small>
                  </div>

                  <button
                    type="button"
                    className="remove-button"
                    onClick={() => {
                      setFile(null);
                      setResults(null);
                      setError("");

                      if (inputRef.current) {
                        inputRef.current.value = "";
                      }
                    }}
                    aria-label="Remove selected image"
                  >
                    ×
                  </button>
                </div>
              )}

              <button
                type="button"
                className="primary-button"
                disabled={!file || loading || !apiOnline}
                onClick={analyzeImage}
              >
                {loading
                  ? "Analyzing image..."
                  : !apiOnline
                    ? "Waiting for API connection"
                    : "Run defect detection"}

                {!loading && <span aria-hidden="true">↗</span>}
              </button>

              <p className="privacy-note">
                <span className="privacy-dot" />
                Image submitted to your locally running API.
              </p>

              {error && (
                <div className="error-message" role="alert">
                  <strong>Inspection issue</strong>
                  <span>{error}</span>
                </div>
              )}
            </article>

            {/* Results panel */}
            <article className="panel results-panel">
              <div className="panel-heading">
                <div>
                  <span className="micro-label">OUTPUT</span>
                  <h3>Inspection results</h3>
                </div>

                <span
                  className={`result-status ${
                    results ? "result-complete" : ""
                  }`}
                >
                  {loading
                    ? "RUNNING"
                    : results
                      ? "COMPLETE"
                      : "AWAITING"}
                </span>
              </div>

              {!results && !loading && (
                <div className="empty-state">
                  <div className="empty-icon">⌕</div>
                  <h3>Ready for inspection</h3>
                  <p>
                    Your detection results will appear here
                    after the image has been analyzed.
                  </p>

                  <div className="workflow">
                    <span>
                      <b>01</b> Upload
                    </span>
                    <i />
                    <span>
                      <b>02</b> Analyze
                    </span>
                    <i />
                    <span>
                      <b>03</b> Review
                    </span>
                  </div>
                </div>
              )}

              {loading && (
                <div className="loading-state" aria-live="polite">
                  <div className="loading-ring" />
                  <h3>Analyzing surface...</h3>
                  <p>
                    Waiting for the YOLO11 model to return
                    its predictions.
                  </p>
                </div>
              )}

              {results && !loading && (
                <div className="results-content">
                  <div className="result-summary">
                    <div>
                      <span className="micro-label">
                        TOTAL DETECTIONS
                      </span>
                      <strong className="result-number">
                        {totalDetections}
                      </strong>
                    </div>

                    <div>
                      <span className="micro-label">
                        MEAN CONFIDENCE
                      </span>
                      <strong className="result-number">
                        {averageConfidence}%
                      </strong>
                    </div>
                  </div>

                  {/* Annotated image with bounding boxes */}
                  {preview && (
                    <div className="result-image-wrap">
                      <div className="annotated-image">
                        <img
                          src={preview}
                          alt="Steel surface with detected defects"
                          className="result-image"
                        />

                        {detections.map((item, index) =>
                          renderBoundingBox(item, index)
                        )}
                      </div>

                      <span className="image-tag">
                        AI DETECTIONS
                      </span>
                    </div>
                  )}

                  <h4 className="table-title">
                    Detected objects
                  </h4>

                  {detections.length === 0 ? (
                    <div className="no-detections">
                      No detections were returned for this image.
                      This does not necessarily mean the steel is
                      defect-free.
                    </div>
                  ) : (
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Defect class</th>
                            <th>Confidence</th>
                          </tr>
                        </thead>

                        <tbody>
                          {detections.map((item, index) => (
                            <tr
                              key={`${item.class_name ?? "defect"}-${index}`}
                            >
                              <td>
                                <span className="detection-marker" />

                                {String(
                                  item.class_name ??
                                    item.name ??
                                    item.class ??
                                    "Unknown"
                                ).replaceAll("_", " ")}
                              </td>

                              <td>
                                {(
                                  Number(item.confidence ?? 0) * 100
                                ).toFixed(1)}
                                %
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </article>
          </div>
        </section>

        {/* Defect analytics */}
        <section
          id="analytics"
          className="section-block analytics-section"
        >
          <div className="section-heading">
            <div>
              <span className="section-index">
                02 / CLASSIFICATION
              </span>
              <h2>Defect categories</h2>
              <p>
                Detection counts from the latest inspection.
              </p>
            </div>

            <span className="section-badge">
              6 TRAINED CLASSES
            </span>
          </div>

          <div className="defect-grid">
            {defectCounts.map((defect) => (
              <article className="defect-card" key={defect.name}>
                <div className="defect-card-top">
                  <span className="defect-number">
                    {defect.number}
                  </span>

                  <span
                    className={`count-indicator ${
                      defect.count > 0 ? "count-active" : ""
                    }`}
                  />
                </div>

                <h3>{defect.label}</h3>

                <div className="defect-card-bottom">
                  <span>
                    {defect.count === 1
                      ? "Detection"
                      : "Detections"}
                  </span>

                  <strong>{defect.count}</strong>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="footer">
          <a className="footer-brand" href="#home">
            <span className="footer-mark">S</span>
            SteelSight AI
          </a>

          <span>Industrial surface inspection</span>
          <span>YOLO11 · FastAPI · React</span>
        </footer>
      </main>
    </div>
  );
}
export default App;