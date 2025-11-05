/**
 * Composant pour afficher les bounding boxes YOLO sur une image
 */

import { useEffect, useState } from "react";
import type { BoundingBox } from "@/types/api";

interface BoundingBoxOverlayProps {
  image: string; // data URL de l'image
  boundingBoxes: BoundingBox[];
}

export const BoundingBoxOverlay = ({ image, boundingBoxes }: BoundingBoxOverlayProps) => {
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setImageDimensions({ width: img.width, height: img.height });
    };
    img.src = image;
  }, [image]);

  return (
    <>
      {boundingBoxes.map((box, index) => (
        <div
          key={index}
          className="absolute border-4 border-primary rounded-lg"
          style={{
            left: `${box.x}%`,
            top: `${box.y}%`,
            width: `${box.width * 3}%`,
            height: `${box.height * 3}%`,
          }}
        >
          {/* Label avec confiance */}
          <div className="absolute -top-6 left-0 bg-primary text-primary-foreground px-2 py-1 rounded text-xs font-bold whitespace-nowrap">
            {box.label} {Math.round(box.confidence * 100)}%
          </div>
        </div>
      ))}
    </>
  );
};
