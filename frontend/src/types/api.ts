/**
 * Types pour les requêtes et réponses de l'API backend
 */

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  label: string;
}

export interface DetectionDetailed {
  classe: string;
  confiance: number;
  bbox: [number, number, number, number]; // [xmin, ymin, xmax, ymax]
  bbox_percent: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface AnalyzeCharlieRequest {
  image: string; // data URL (data:image/jpeg;base64,...)
  confidence_threshold?: number;
  draw_boxes?: boolean;
}

export interface AnalyzeCharlieResponse {
  success: boolean;
  detected: boolean;
  result: {
    label: string;
    confidence: number;
    processing_time: number;
    annotated_image: string; // data URL avec bounding boxes dessinées
    bounding_boxes: BoundingBox[];
    detections_detailed: DetectionDetailed[];
    classes_detected: string[];
  };
  metadata: {
    model: string;
    model_classes: string[];
    total_detections: number;
    confidence_threshold: number;
    image_processed_at_640x640: boolean;
  };
}

export interface HealthCheckResponse {
  status: string;
  message: string;
  model: {
    status: string;
    info: {
      path: string;
      exists: boolean;
      classes: string[];
      num_classes: number;
    };
    type: string;
  };
}
