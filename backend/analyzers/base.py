from abc import ABC, abstractmethod
from typing import Any, Dict


class Analyzer(ABC):
    """Contrat minimal pour un analyseur d'image.

    Entrée: image PIL/numpy déjà décodée ou data URL (selon implémentation).
    Sortie: dict avec 'detected' bool, 'bounding_boxes' en %, 'confidence' global, et metadata.
    """

    @abstractmethod
    def analyze(self, image_bgr) -> Dict[str, Any]:
        """Analyse une image BGR (numpy) et retourne un dict standardisé.

        bounding_boxes: liste de {x, y, width, height, confidence} en pourcentage du W/H.
        """
        raise NotImplementedError
