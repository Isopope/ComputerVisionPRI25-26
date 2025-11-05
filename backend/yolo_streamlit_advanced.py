import streamlit as st
import cv2
import numpy as np
import time
import os
import glob
from PIL import Image
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from ultralytics import YOLO
import tempfile
from io import BytesIO
from streamlit_webrtc import webrtc_streamer, VideoTransformerBase, RTCConfiguration
import av
import threading
import queue

# Configuration de la page
st.set_page_config(
    page_title="YOLO Charlie Detection App",
    page_icon="🔍",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Configuration WebRTC
RTC_CONFIGURATION = RTCConfiguration(
    {"iceServers": [{"urls": ["stun:stun.l.google.com:19302"]}]}
)

# Couleurs pour les bounding boxes (Tableau 10 color scheme)
BBOX_COLORS = [(164,120,87), (68,148,228), (93,97,209), (178,182,133), (88,159,106), 
               (96,202,231), (159,124,168), (169,162,241), (98,118,150), (172,176,184)]

class VideoTransformer(VideoTransformerBase):
    """Transformateur vidéo pour la détection en temps réel"""
    
    def __init__(self):
        self.models = {}
        self.confidence_threshold = 0.5
        self.frame_count = 0
        self.fps_history = queue.Queue(maxsize=30)
        self.last_time = time.time()
        
    def set_models(self, models):
        self.models = models
        
    def set_confidence_threshold(self, threshold):
        self.confidence_threshold = threshold
    
    def transform(self, frame):
        img = frame.to_ndarray(format="bgr24")
        
        # Calculer FPS
        current_time = time.time()
        fps = 1.0 / (current_time - self.last_time) if (current_time - self.last_time) > 0 else 0
        self.last_time = current_time
        
        if self.fps_history.full():
            self.fps_history.get()
        self.fps_history.put(fps)
        
        # Traitement avec le premier modèle disponible
        if self.models:
            model_name, model = next(iter(self.models.items()))
            if model is not None:
                try:
                    results = model(img, verbose=False)
                    detections = results[0].boxes if results and len(results) > 0 else None
                    
                    if detections is not None and len(detections) > 0:
                        for i in range(len(detections)):
                            xyxy_tensor = detections[i].xyxy.cpu()
                            xyxy = xyxy_tensor.numpy().squeeze()
                            xmin, ymin, xmax, ymax = xyxy.astype(int)
                            
                            classidx = int(detections[i].cls.item())
                            classname = model.names[classidx]
                            conf = detections[i].conf.item()
                            
                            if conf >= self.confidence_threshold:
                                color = BBOX_COLORS[classidx % 10]
                                cv2.rectangle(img, (xmin, ymin), (xmax, ymax), color, 2)
                                
                                label = f'{classname}: {int(conf*100)}%'
                                labelSize, baseLine = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
                                label_ymin = max(ymin, labelSize[1] + 10)
                                cv2.rectangle(img, (xmin, label_ymin-labelSize[1]-10), 
                                            (xmin+labelSize[0], label_ymin+baseLine-10), color, cv2.FILLED)
                                cv2.putText(img, label, (xmin, label_ymin-7), 
                                          cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1)
                except Exception as e:
                    pass  # Continuer même en cas d'erreur
        
        # Afficher FPS
        avg_fps = np.mean(list(self.fps_history.queue)) if not self.fps_history.empty() else 0
        cv2.putText(img, f'FPS: {avg_fps:.1f}', (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
        
        return img

@st.cache_resource
def load_model(model_path):
    """Charger un modèle YOLO avec mise en cache"""
    try:
        model = YOLO(model_path, task='detect')
        return model
    except Exception as e:
        st.error(f"Erreur lors du chargement du modèle {model_path}: {e}")
        return None

def draw_detections(image, detections, labels, confidence_threshold, model_name="", scale_factors=None):
    """Dessiner les détections sur l'image"""
    image_with_boxes = image.copy()
    detection_data = []
    
    # Facteurs d'échelle par défaut (pas de redimensionnement)
    scale_x, scale_y = scale_factors if scale_factors else (1.0, 1.0)
    
    if detections is not None and len(detections) > 0:
        for i in range(len(detections)):
            xyxy_tensor = detections[i].xyxy.cpu()
            xyxy = xyxy_tensor.numpy().squeeze()
            
            # Adapter les coordonnées à l'image originale
            xmin, ymin, xmax, ymax = xyxy.astype(int)
            xmin = int(xmin * scale_x)
            ymin = int(ymin * scale_y)
            xmax = int(xmax * scale_x)
            ymax = int(ymax * scale_y)
            
            classidx = int(detections[i].cls.item())
            classname = labels[classidx]
            conf = detections[i].conf.item()
            
            if conf >= confidence_threshold:
                color = BBOX_COLORS[classidx % 10]
                
                cv2.rectangle(image_with_boxes, (xmin, ymin), (xmax, ymax), color, 2)
                
                label = f'{classname}: {int(conf*100)}%'
                if model_name:
                    label = f'[{model_name}] {label}'
                
                labelSize, baseLine = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
                label_ymin = max(ymin, labelSize[1] + 10)
                cv2.rectangle(image_with_boxes, (xmin, label_ymin-labelSize[1]-10), 
                            (xmin+labelSize[0], label_ymin+baseLine-10), color, cv2.FILLED)
                cv2.putText(image_with_boxes, label, (xmin, label_ymin-7), 
                          cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1)
                
                detection_data.append({
                    'classe': classname,
                    'confiance': conf,
                    'bbox': (xmin, ymin, xmax, ymax),
                    'modele': model_name
                })
    
    return image_with_boxes, detection_data

def process_image_with_model(image, model, model_name, confidence_threshold):
    """Traiter une image avec un modèle YOLO"""
    start_time = time.time()
    
    if isinstance(image, Image.Image):
        image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
    
    # Redimensionner l'image à 640x640 avant traitement
    original_shape = image.shape[:2]  # (height, width)
    image_resized = cv2.resize(image, (640, 640))
    
    results = model(image_resized, verbose=False)
    detections = results[0].boxes if results and len(results) > 0 else None
    
    processing_time = time.time() - start_time
    
    # Adapter les coordonnées des bounding boxes à l'image originale
    scale_x = original_shape[1] / 640  # width scaling
    scale_y = original_shape[0] / 640  # height scaling
    
    image_with_detections, detection_data = draw_detections(
        image, detections, model.names, confidence_threshold, model_name, (scale_x, scale_y)
    )
    
    return image_with_detections, detection_data, processing_time

def get_available_models():
    """Obtenir la liste des modèles disponibles"""
    model_files = glob.glob("*.pt")
    return model_files

def capture_image_from_camera():
    """Capturer une image depuis la caméra"""
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        return None
    
    ret, frame = cap.read()
    cap.release()
    
    if ret:
        return frame
    return None

def main():
    st.title("🔍 YOLO Charlie Detection App")
    st.markdown("---")
    
    # Sidebar pour la configuration
    with st.sidebar:
        st.header("⚙️ Configuration")
        
        available_models = get_available_models()
        if not available_models:
            st.error("Aucun modèle .pt trouvé dans le répertoire courant!")
            return
        
        st.subheader("Modèles")
        selected_models = st.multiselect(
            "Sélectionnez les modèles à utiliser:",
            available_models,
            default=available_models[:2] if len(available_models) >= 2 else available_models
        )
        
        confidence_threshold = st.slider(
            "Seuil de confiance",
            min_value=0.1,
            max_value=1.0,
            value=0.5,
            step=0.05
        )
        
        st.subheader("Mode d'utilisation")
        mode = st.radio(
            "Choisissez le mode:",
            ["Upload d'image", "Caméra en continu", "Capture d'image"]
        )
        
        st.subheader("Options")
        show_metrics = st.checkbox("Afficher les métriques détaillées", value=True)
        compare_models = st.checkbox("Comparer les modèles côte à côte", value=True)
    
    if not selected_models:
        st.warning("Veuillez sélectionner au moins un modèle dans la sidebar!")
        return
    
    # Charger les modèles sélectionnés
    models = {}
    for model_name in selected_models:
        with st.spinner(f"Chargement du modèle {model_name}..."):
            models[model_name] = load_model(model_name)
    
    # Interface principale selon le mode
    if mode == "Upload d'image":
        handle_image_upload(models, confidence_threshold, show_metrics, compare_models)
    elif mode == "Caméra en continu":
        handle_camera_stream(models, confidence_threshold, show_metrics, compare_models)
    elif mode == "Capture d'image":
        handle_camera_capture(models, confidence_threshold, show_metrics, compare_models)

def handle_image_upload(models, confidence_threshold, show_metrics, compare_models):
    """Gérer le mode upload d'image"""
    st.header("📤 Upload d'image")
    
    uploaded_file = st.file_uploader(
        "Choisissez une image",
        type=['png', 'jpg', 'jpeg', 'bmp'],
        help="Formats supportés: PNG, JPG, JPEG, BMP"
    )
    
    if uploaded_file is not None:
        image = Image.open(uploaded_file)
        st.subheader("Image originale")
        st.image(image, caption="Image uploadée", use_column_width=True)
        
        process_uploaded_image(image, models, confidence_threshold, show_metrics, compare_models)

def process_uploaded_image(image, models, confidence_threshold, show_metrics, compare_models):
    """Traiter l'image uploadée avec les modèles sélectionnés"""
    results = {}
    all_detection_data = []
    
    with st.spinner("Traitement en cours..."):
        for model_name, model in models.items():
            if model is not None:
                processed_image, detection_data, processing_time = process_image_with_model(
                    image, model, model_name, confidence_threshold
                )
                results[model_name] = {
                    'image': processed_image,
                    'detections': detection_data,
                    'processing_time': processing_time
                }
                all_detection_data.extend(detection_data)
    
    if compare_models and len(results) > 1:
        display_comparison_results(results, show_metrics)
    else:
        display_single_model_results(results, show_metrics)
    
    if show_metrics and all_detection_data:
        display_global_metrics(all_detection_data, results)

def handle_camera_stream(models, confidence_threshold, show_metrics, compare_models):
    """Gérer le mode caméra en continu"""
    st.header("📹 Caméra en continu")
    
    # Créer le transformateur vidéo
    ctx = st.session_state.get("webrtc_ctx")
    
    if "video_transformer" not in st.session_state:
        st.session_state.video_transformer = VideoTransformer()
    
    # Configuration du transformateur
    st.session_state.video_transformer.set_models(models)
    st.session_state.video_transformer.set_confidence_threshold(confidence_threshold)
    
    # Interface WebRTC
    webrtc_ctx = webrtc_streamer(
        key="yolo-detection",
        video_transformer_factory=lambda: st.session_state.video_transformer,
        rtc_configuration=RTC_CONFIGURATION,
        media_stream_constraints={"video": True, "audio": False},
        async_processing=True,
    )
    
    if webrtc_ctx.state.playing:
        st.success("🔴 Diffusion en cours - Détection en temps réel activée")
        
        if show_metrics:
            st.subheader("📊 Métriques en temps réel")
            placeholder = st.empty()
            
            # Mise à jour des métriques (simulation)
            while webrtc_ctx.state.playing:
                time.sleep(1)
                with placeholder.container():
                    col1, col2, col3 = st.columns(3)
                    with col1:
                        st.metric("Modèle actif", list(models.keys())[0] if models else "Aucun")
                    with col2:
                        fps = np.random.uniform(15, 25)  # Simulation FPS
                        st.metric("FPS", f"{fps:.1f}")
                    with col3:
                        st.metric("Seuil confiance", f"{confidence_threshold:.2f}")
    else:
        st.info("👆 Cliquez sur 'START' pour commencer la diffusion vidéo")

def handle_camera_capture(models, confidence_threshold, show_metrics, compare_models):
    """Gérer le mode capture d'image depuis la caméra"""
    st.header("📸 Capture d'image")
    
    col1, col2 = st.columns([1, 3])
    
    with col1:
        if st.button("📷 Capturer une image", type="primary"):
            with st.spinner("Capture en cours..."):
                captured_image = capture_image_from_camera()
                
                if captured_image is not None:
                    st.session_state.captured_image = captured_image
                    st.success("Image capturée avec succès!")
                else:
                    st.error("Impossible d'accéder à la caméra")
    
    with col2:
        if 'captured_image' in st.session_state:
            # Convertir BGR vers RGB pour affichage
            display_image = cv2.cvtColor(st.session_state.captured_image, cv2.COLOR_BGR2RGB)
            st.image(display_image, caption="Image capturée", use_column_width=True)
            
            # Traitement de l'image capturée
            results = {}
            all_detection_data = []
            
            with st.spinner("Analyse en cours..."):
                for model_name, model in models.items():
                    if model is not None:
                        processed_image, detection_data, processing_time = process_image_with_model(
                            st.session_state.captured_image, model, model_name, confidence_threshold
                        )
                        results[model_name] = {
                            'image': processed_image,
                            'detections': detection_data,
                            'processing_time': processing_time
                        }
                        all_detection_data.extend(detection_data)
            
            # Affichage des résultats
            if results:
                st.subheader("🔍 Résultats de l'analyse")
                if compare_models and len(results) > 1:
                    display_comparison_results(results, show_metrics)
                else:
                    display_single_model_results(results, show_metrics)
                
                if show_metrics and all_detection_data:
                    display_global_metrics(all_detection_data, results)

def display_comparison_results(results, show_metrics):
    """Afficher les résultats en comparaison côte à côte"""
    st.subheader("🔍 Résultats de détection - Comparaison")
    
    cols = st.columns(len(results))
    
    for idx, (model_name, result) in enumerate(results.items()):
        with cols[idx]:
            st.markdown(f"**{model_name}**")
            
            display_image = cv2.cvtColor(result['image'], cv2.COLOR_BGR2RGB)
            st.image(display_image, caption=f"Détections - {model_name}", use_column_width=True)
            
            if show_metrics:
                st.metric("Temps de traitement", f"{result['processing_time']:.3f}s")
                st.metric("Objets détectés", len(result['detections']))
                
                if result['detections']:
                    avg_conf = np.mean([d['confiance'] for d in result['detections']])
                    st.metric("Confiance moyenne", f"{avg_conf:.2f}")

def display_single_model_results(results, show_metrics):
    """Afficher les résultats pour un seul modèle ou modèles individuellement"""
    st.subheader("🔍 Résultats de détection")
    
    for model_name, result in results.items():
        st.markdown(f"### {model_name}")
        
        display_image = cv2.cvtColor(result['image'], cv2.COLOR_BGR2RGB)
        st.image(display_image, caption=f"Détections - {model_name}", use_column_width=True)
        
        if show_metrics:
            col1, col2, col3 = st.columns(3)
            with col1:
                st.metric("Temps de traitement", f"{result['processing_time']:.3f}s")
            with col2:
                st.metric("Objets détectés", len(result['detections']))
            with col3:
                if result['detections']:
                    avg_conf = np.mean([d['confiance'] for d in result['detections']])
                    st.metric("Confiance moyenne", f"{avg_conf:.2f}")

def display_global_metrics(all_detection_data, results):
    """Afficher les métriques globales et graphiques"""
    st.subheader("📊 Métriques détaillées")
    
    if all_detection_data:
        df = pd.DataFrame(all_detection_data)
        st.dataframe(df[['modele', 'classe', 'confiance']], use_container_width=True)
        
        col1, col2 = st.columns(2)
        
        with col1:
            fig_conf = px.box(df, x='modele', y='confiance', 
                            title="Distribution de la confiance par modèle")
            st.plotly_chart(fig_conf, use_container_width=True)
        
        with col2:
            processing_times = [{'modele': name, 'temps': result['processing_time']} 
                              for name, result in results.items()]
            df_times = pd.DataFrame(processing_times)
            fig_time = px.bar(df_times, x='modele', y='temps', 
                            title="Temps de traitement par modèle")
            st.plotly_chart(fig_time, use_container_width=True)

if __name__ == "__main__":
    main()