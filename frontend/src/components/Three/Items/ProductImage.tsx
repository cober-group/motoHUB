import { Image } from '@react-three/drei';
import { useProcessedImage } from '@/hooks/useProcessedImage';

interface ProductImageProps {
  base64?: string;
  scale?: number | [number, number];
  position?: [number, number, number];
  transparent?: boolean;
  [key: string]: any;
}

export function ProductImage({ base64, scale, position, transparent = true, ...props }: ProductImageProps) {
  const { processedUrl } = useProcessedImage(base64);
  return (
    <Image 
      url={processedUrl} 
      scale={scale} 
      position={position} 
      transparent={transparent} 
      {...props} 
    />
  );
}
